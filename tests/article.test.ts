import { mkdir, writeFile } from 'node:fs/promises';
import { decodeHTML } from 'entities';
import { PNG } from 'pngjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { ImageStore } from '../src/core/images.js';
import { Renderer } from '../src/core/renderer.js';
import { ArticleBody, loadArticleImages } from '../src/templates/article/body.js';
import { article } from '../src/templates/article/index.js';
import { articleSchema } from '../src/templates/article/schema.js';
import { createTemplateRegistry } from '../src/templates/index.js';

let renderer: Renderer;
const context = { assets: {}, fontFamily: 'sans-serif', monospaceFontFamily: 'monospace' };
beforeAll(async () => {
  const registry = createTemplateRegistry();
  const config = loadConfig({ LOG_LEVEL: 'silent' });
  renderer = new Renderer(config, await loadFonts(config.fontConfig), registry);
});
afterEach(() => vi.restoreAllMocks());

it('loads the optional avatar in text mode and deduplicates it with Markdown images', async () => {
  const images = new ImageStore(loadConfig({ LOG_LEVEL: 'silent' }));
  const get = vi.spyOn(images, 'get').mockResolvedValue('data:image/png;base64,example');
  const url = 'https://example.com/avatar.png';
  await loadArticleImages({ content: '正文', contentFormat: 'text', authorAvatarUrl: url }, images);
  expect(get).toHaveBeenCalledExactlyOnceWith(url);
  get.mockClear();
  await loadArticleImages(
    { content: '![头像](' + url + ')', authorAvatarUrl: url, translation: { text: '![avatar](' + url + ')' } },
    images,
  );
  expect(get).toHaveBeenCalledExactlyOnceWith(url);
  get.mockClear();
  await loadArticleImages({ content: '正文', authorAvatarUrl: '' }, images);
  expect(get).not.toHaveBeenCalled();
});

it('renders a circular avatar, supports avatar-only metadata and survives image failure', async () => {
  const image = new PNG({ width: 80, height: 40 });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([220, 30, 40, 255], i);
  const uri = 'data:image/png;base64,' + PNG.sync.write(image).toString('base64');
  const get = vi.spyOn(ImageStore.prototype, 'get').mockResolvedValue(uri);
  const data = {
    content: '头像位于作者和时间左侧。',
    author: 'Forma 编辑部',
    publishedAt: '2026-10-15 10:30',
    authorAvatarUrl: 'https://example.com/avatar.png',
  };
  const result = await renderer.render({ template: 'article', data, format: 'png' });
  expect(result.warnings).toEqual([]);
  const png = PNG.sync.read(Buffer.from(result.body));
  const pixel = (x: number, y: number) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
  expect(pixel(92, 92).every((value, i) => Math.abs(value - [220, 30, 40][i]!) <= 3)).toBe(true);
  // The square's corner is clipped to the white card by the circular avatar.
  expect(pixel(58, 58)).toEqual([255, 255, 255]);
  await mkdir('artifacts/article', { recursive: true });
  await writeFile('artifacts/article/avatar.png', result.body);
  const solo = await renderer.render({
    template: 'article',
    data: { content: '正文', authorAvatarUrl: data.authorAvatarUrl },
    format: 'svg',
  });
  expect(solo.warnings).toEqual([]);
  expect(Buffer.from(solo.body).toString()).toContain('data:image/png;base64,');
  get.mockRejectedValue(new Error('Image unavailable'));
  const failed = await renderer.render({ template: 'article', data, format: 'png' });
  expect(failed.warnings).toEqual(['IMAGE_UNAVAILABLE']);
  expect(failed.height).toBe(result.height);
  await writeFile('artifacts/article/avatar-failed.png', failed.body);
  expect(renderToStaticMarkup(article.render(data, context))).toContain('FO');
  expect(
    renderToStaticMarkup(article.render({ content: '正文', authorAvatarUrl: data.authorAvatarUrl }, context)),
  ).toContain('>?</span>');
  const missingName = await renderer.render({
    template: 'article',
    data: { content: '正文', authorAvatarUrl: data.authorAvatarUrl },
    format: 'svg',
  });
  expect(missingName.warnings).toEqual(['IMAGE_UNAVAILABLE']);
});

function highlights(text: string, format: 'markdown' | 'text' = 'text') {
  const html = renderToStaticMarkup(createElement(ArticleBody, { text, format, context }));
  return [...html.matchAll(/<span style="[^"]*color:#0969da[^"]*">([^<]*)<\/span>/g)].map(match =>
    decodeHTML(match[1]!),
  );
}

it('highlights Twitter hashtags and mentions with Unicode, boundaries and the current handle length limit', () => {
  expect(highlights('#中文 #hello_world #123 #123go ＃全角 #café #タグ')).toEqual([
    '#中文',
    '#hello_world',
    '#123go',
    '＃全角',
    '#café',
    '#タグ',
  ]);
  expect(highlights('@alice @user_01 @abcdefghijklmno @abcdefghijklmnop @中文 ＠bob')).toEqual([
    '@alice',
    '@user_01',
    '@abcdefghijklmno',
    '＠bob',
  ]);
  expect(highlights('person@example.com word@alice foo#tag https://example.com/@alice#tag')).toEqual([]);
  expect(highlights('👋 @alice #hello\n@user.name @user-name')).toEqual(['@alice', '#hello', '@user', '@user']);
  expect(highlights('RT@alice @alice/list')).toEqual(['@alice', '@alice']);
});

it('highlights Markdown visible text while preserving code, escapes and existing links', () => {
  expect(
    highlights(
      '# 标题 @alice\n\n**#话题** 和 *＠bob*\n\n> #引用\n\n- @list\n\n| 主题 |\n| --- |\n| #表格 |',
      'markdown',
    ),
  ).toEqual(['@alice', '#话题', '＠bob', '#引用', '@list', '#表格']);
  expect(highlights('`#code @code`\n\n```\n#block @block\n```\n\n\\#escaped \\@escaped', 'markdown')).toEqual([]);
  // Existing links keep their whole label, now using the shared highlight color.
  expect(highlights('[**#link @linked**](https://example.com) https://example.com/@name#fragment', 'markdown')).toEqual(
    ['#link @linked', 'https://example.com/@name#fragment'],
  );
  expect(highlights('foo**bar**@alice **word**#topic #123**go** **@ali**ce', 'markdown')).toEqual([
    '#123',
    'go',
    '@ali',
    'ce',
  ]);
  expect(highlights('word`code`#topic #ha`sh`tag', 'markdown')).toEqual([]);
});

it.each(['markdown', 'text'] as const)('renders highlights in both original and translated %s bodies', async format => {
  const data = {
    title: 'Hashtag 与 @提及',
    content: '正文：#中文话题 #hello_world @alice\n非话题/提及：#123 word@alice',
    contentFormat: format,
    translation: {
      text: 'Translation: #翻译话题 #2026go @user_01\nPlain: #123 word@alice',
      format,
      model: 'GPT',
      sourceLanguage: '中文',
    },
  };
  const html = renderToStaticMarkup(article.render(data, context));
  expect([...html.matchAll(/color:#0969da/g)]).toHaveLength(6);
  const pngResult = await renderer.render({ template: 'article', format: 'png', data });
  expect(pngResult.warnings).toEqual([]);
  const png = PNG.sync.read(Buffer.from(pngResult.body));
  let bluePixels = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (
      Math.abs(png.data[i]! - 9) < 10 &&
      Math.abs(png.data[i + 1]! - 105) < 10 &&
      Math.abs(png.data[i + 2]! - 218) < 10
    )
      bluePixels++;
  }
  expect(bluePixels).toBeGreaterThan(100);
  await mkdir('artifacts/article', { recursive: true });
  await writeFile('artifacts/article/highlights-' + format + '.png', pngResult.body);
  const svg = await renderer.render({ template: 'article', format: 'svg', data });
  expect(Buffer.from(svg.body).toString()).toContain('#0969da');
});

it('requires only nonblank content and allows each translation field independently', () => {
  expect(articleSchema.safeParse({ content: '正文' }).success).toBe(true);
  expect(articleSchema.safeParse({ content: '正文', authorAvatarUrl: '' }).success).toBe(true);
  expect(articleSchema.safeParse({ content: '正文', authorAvatarUrl: 'https://example.com/avatar.png' }).success).toBe(
    true,
  );
  expect(articleSchema.safeParse(article.mock).success).toBe(true);
  for (const translation of [
    {},
    { title: 'Translated title' },
    { text: 'Body' },
    { model: 'GPT' },
    { sourceLanguage: '英语' },
  ]) {
    expect(articleSchema.safeParse({ content: '正文', translation }).success).toBe(true);
  }
  for (const data of [
    {},
    { content: '' },
    { content: ' \n ' },
    { content: 123 },
    { content: 'x', watermark: 'x' },
    { content: 'x', contentFormat: 'html' },
    { content: 'x', authorAvatarUrl: 'ftp://example.com/avatar.png' },
    { content: 'x', authorAvatarUrl: 'data:image/png;base64,abc' },
    { content: 'x', translation: { unknown: true } },
  ]) {
    expect(articleSchema.safeParse(data).success).toBe(false);
  }
});

it('preserves literal text and renders Markdown without interpreting HTML', () => {
  const text = '# Heading\n**strong** &amp; <b>literal</b>';
  const plain = renderToStaticMarkup(createElement(ArticleBody, { text, format: 'text', context }));
  expect(plain).toContain('# Heading\n**strong** &amp;amp; &lt;b&gt;literal&lt;/b&gt;');
  const markdown = renderToStaticMarkup(createElement(ArticleBody, { text, context }));
  expect(markdown).not.toContain('**strong**');
  expect(markdown).toContain('font-weight:700');
  expect(markdown).toContain('strong');
  expect(markdown).not.toContain('&amp;amp;');
  expect(markdown).not.toContain('<b>');
  const hidden = renderToStaticMarkup(article.render({ content: '正文', translation: {} }, context));
  expect(hidden).not.toContain('翻译');
});

it('renders full article, title-only translation, and long multilingual text to real images', async () => {
  const full = await renderer.render({
    template: 'article',
    data: { ...article.mock, authorAvatarUrl: '' },
    format: 'png',
    watermark: 'Generated by Forma',
  });
  expect(full.width).toBe(1400);
  expect(full.warnings).toEqual([]);
  const png = PNG.sync.read(Buffer.from(full.body));
  expect(png.height).toBe(full.height);
  // Padded translation panels must stay inside the common frame.
  for (let y = 0; y < png.height; y++) {
    const offset = (y * png.width + png.width - 8) * 4;
    expect([...png.data.subarray(offset, offset + 3)]).toEqual([245, 245, 245]);
  }
  await mkdir('artifacts/article', { recursive: true });
  await writeFile('artifacts/article/preview.png', full.body);
  const minimal = await renderer.render({ template: 'article', data: { content: '正文' }, format: 'svg' });
  const empty = await renderer.render({
    template: 'article',
    data: {
      content: '正文',
      title: ' ',
      author: '',
      authorAvatarUrl: '',
      publishedAt: '',
      translation: { title: '', text: ' ' },
      source: '',
      url: '',
    },
    format: 'svg',
  });
  expect(empty.body).toEqual(minimal.body);
  const titleOnly = await renderer.render({
    template: 'article',
    data: { content: '正文', translation: { title: 'Translated title' } },
    format: 'svg',
  });
  expect(titleOnly.height).toBeGreaterThan(minimal.height);
  const long = await renderer.render({
    template: 'article',
    data: {
      content: '中文 日本語 한국어 English '.repeat(90) + '\n' + 'LongWord'.repeat(60),
      contentFormat: 'text',
      translation: { text: '**literal**\n# Heading', format: 'text' },
    },
    format: 'png',
  });
  expect(long.width).toBe(1400);
  expect(long.layoutHeight).toBeGreaterThan(minimal.height + 300);
  await writeFile('artifacts/article/long.png', long.body);
});

it('renders GFM blocks, inline styles, code, nested lists, tables and images through Satori and Skia', async () => {
  const image = new PNG({ width: 1000, height: 200 });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([220, 30, 40, 255], i);
  const get = vi
    .spyOn(ImageStore.prototype, 'get')
    .mockResolvedValue('data:image/png;base64,' + PNG.sync.write(image).toString('base64'));
  const content =
    '# 标题一\n\n## 标题二\n\n普通 **加粗**、*斜体*、~~删除线~~、`inline code` 和 [链接](https://example.com)。\n下一行 &amp; 实体。\n\n> 引用\n>\n> 第二段\n\n3. 第三项\n4. 第四项\n   - 嵌套列表\n\n- [x] 已完成\n- [ ] 待完成\n\n```ts\nconst value = "<tag> &amp;";\nconsole.log(value);\n```\n\n| 项目 | 状态 |\n| :--- | ---: |\n| **渲染** | 完成 |\n| 长文本 | 自动换行 |\n\n---\n\n图片前 ![测试图片](https://example.com/test.png) 图片后\n\n[![引用图片][img]](https://example.com)\n\n[img]: https://example.com/test.png';
  const result = await renderer.render({ template: 'article', data: { content }, format: 'png' });
  expect(get).toHaveBeenCalledTimes(1);
  expect(result.warnings).toEqual([]);
  const png = PNG.sync.read(Buffer.from(result.body));
  let redPixels = 0;
  for (let i = 0; i < png.data.length; i += 4)
    if (Math.abs(png.data[i]! - 220) < 5 && Math.abs(png.data[i + 1]! - 30) < 5) redPixels++;
  expect(redPixels).toBeGreaterThan(10000);
  await writeFile('artifacts/article/markdown.png', result.body);
  const svg = await renderer.render({ template: 'article', data: { content }, format: 'svg' });
  expect(Buffer.from(svg.body).toString()).not.toContain('https://example.com/test.png');
});

it('loads only Markdown images, leaves plain text and HTML inert, and keeps failed image placeholders', async () => {
  const config = loadConfig({ LOG_LEVEL: 'silent' });
  const images = new ImageStore(config);
  const get = vi.spyOn(images, 'get').mockResolvedValue('data:image/png;base64,example');
  await loadArticleImages(
    {
      content: '![plain](https://example.com/plain.png)',
      contentFormat: 'text',
      translation: {
        text: '![translated](https://example.com/translated.png)\n<img src="https://example.com/html.png">',
      },
    },
    images,
  );
  expect(get).toHaveBeenCalledExactlyOnceWith('https://example.com/translated.png');
  const failed = await renderer.render({
    template: 'article',
    data: { content: '![blocked](ftp://example.com/private.png)\n\n![invalid](__proto__)' },
    format: 'png',
  });
  expect(failed.warnings).toEqual(['IMAGE_UNAVAILABLE']);
  expect(failed.width).toBe(1400);
});

it('preserves soft breaks, hard breaks and paragraph spacing after typography changes', async () => {
  const render = async (content: string, contentFormat: 'markdown' | 'text' = 'markdown') =>
    renderer.render({ template: 'article', data: { content, contentFormat }, format: 'png' });
  const single = await render('alpha beta');
  const soft = await render('alpha\nbeta');
  const hard = await render('alpha  \nbeta');
  const paragraph = await render('alpha\n\nbeta');
  const plain = await render('alpha\nbeta', 'text');
  expect(soft.height).toBeGreaterThan(single.height);
  expect(hard.height).toBe(soft.height);
  expect(plain.height).toBe(soft.height);
  expect(paragraph.height).toBeGreaterThan(soft.height);
});

it('preserves combined emphasis and link decoration, with relative inline code sizing', async () => {
  const text = '普通 *Italic 中文* **Bold** ***Both*** [~~removed~~](https://example.com) `inline()`';
  const html = renderToStaticMarkup(createElement(ArticleBody, { text, context }));
  expect(html).toMatch(/font-style:italic[^>]*>Italic 中文/);
  expect(html).toMatch(/font-weight:700[^>]*>Bold/);
  expect(html).toMatch(/font-style:italic;font-weight:700[^>]*>Both/);
  expect(html).toContain('text-decoration:underline line-through');
  expect(html).toContain('font-size:0.9em');
  const result = await renderer.render({ template: 'article', data: { content: text }, format: 'png' });
  expect(result.warnings).toEqual([]);
  const normal = await renderer.render({ template: 'article', data: { content: 'Emphasis' }, format: 'png' });
  const italic = await renderer.render({ template: 'article', data: { content: '*Emphasis*' }, format: 'png' });
  expect(Buffer.from(italic.body).equals(Buffer.from(normal.body))).toBe(false);
});

it('keeps code lines and every wide-table value readable without widening the image', async () => {
  const code = '```ts\nconst long = "' + 'identifier'.repeat(25) + '";\n\n    return long;\n```';
  const table =
    '| Name | Description | Count | State | Notes |\n| --- | --- | ---: | --- | --- |\n' +
    '| A | 多列内容 | 123 | **Ready** | 最后一列不能丢失 |\n| B | second row | 456 | *Waiting* | 第二条记录 |';
  const text = code + '\n\n' + table;
  const html = renderToStaticMarkup(createElement(ArticleBody, { text, context }));
  expect(html).toContain('记录 1');
  expect(html).toContain('记录 2');
  expect(html).toContain('最后一列不能丢失');
  expect(html).toContain('第二条记录');
  expect(html).toContain('>3</div>'); // Blank source line still occupies line 2.
  expect(html).toContain('    return long;');
  const result = await renderer.render({ template: 'article', data: { content: text }, format: 'png' });
  expect(result.width).toBe(1400);
  expect(result.warnings).toEqual([]);
  await mkdir('artifacts/article', { recursive: true });
  await writeFile('artifacts/article/wide-table-code.png', result.body);
  const headerOnly = await renderer.render({
    template: 'article',
    data: { content: table.split('\n').slice(0, 2).join('\n') },
    format: 'png',
  });
  expect(headerOnly.width).toBe(1400);
  expect(headerOnly.warnings).toEqual([]);
});
