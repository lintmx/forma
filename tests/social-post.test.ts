import { mkdir, writeFile } from 'node:fs/promises';
import { decodeHTML } from 'entities';
import { PNG } from 'pngjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import satori from 'satori';
import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { CardFrame } from '../src/core/card.js';
import { type LoadedFonts, loadFonts } from '../src/core/fonts.js';
import { ImageStore, imageDataUri } from '../src/core/images.js';
import { rasterize } from '../src/core/rasterize.js';
import { Renderer } from '../src/core/renderer.js';
import { textStyle, typography } from '../src/core/typography.js';
import { createTemplateRegistry } from '../src/templates/index.js';
import { socialPost } from '../src/templates/social_post/index.js';
import { socialPostSchema } from '../src/templates/social_post/schema.js';
import { expectPngQuality } from './fixtures/png-quality.js';

const registry = createTemplateRegistry();
const config = loadConfig({ LOG_LEVEL: 'silent' });
let renderer: Renderer;
let fonts: LoadedFonts;

function image(width: number, height: number, color: [number, number, number]) {
  const png = new PNG({ width, height });
  for (let index = 0; index < png.data.length; index += 4) png.data.set([...color, 255], index);
  return PNG.sync.write(png);
}
const red = image(120, 240, [220, 30, 40]);
const green = image(240, 120, [30, 170, 70]);
const blue = image(160, 120, [30, 80, 220]);
const source = (name: string) => 'https://images.example.com/' + name + '.png';
const media = [
  { url: source('red'), alt: '竖图' },
  { url: source('green'), alt: '横图' },
  { url: 'https://example.com/video.mp4', type: 'video' as const, previewUrl: source('blue') },
];
const imageBuffer = (url: string) => (url.includes('red') ? red : url.includes('green') ? green : blue);
const nearColor = (pixels: Uint8Array, offset: number, color: readonly number[]) =>
  color.every((value, channel) => Math.abs(pixels[offset + channel]! - value) <= 3);

beforeAll(async () => {
  fonts = await loadFonts(config.fontConfig);
  renderer = new Renderer(config, fonts, registry);
  registry.register({
    ...socialPost,
    id: 'test-social-plain',
    render: data =>
      createElement(
        'div',
        {
          style: {
            display: 'block',
            boxSizing: 'border-box',
            width: '100%',
            minWidth: 0,
            ...typography.body,
            ...textStyle,
            marginBottom: 12,
          },
        },
        createElement('span', {}, data.content ?? ''),
      ),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

function mockImages() {
  return vi.spyOn(ImageStore.prototype, 'get').mockImplementation(async url => {
    if (url.includes('missing')) throw new Error('Image unavailable');
    return imageDataUri(imageBuffer(url), config);
  });
}
const render = (data: unknown, format: 'png' | 'svg' = 'png') =>
  renderer.render({ template: 'social_post', data, format });

describe('social_post contract', () => {
  it('accepts optional sections, empty content and a media-only post', () => {
    for (const data of [{}, { author: {}, content: '' }, { media }, socialPost.mock]) {
      expect(registry.validate('social_post', data)).toEqual(data);
    }
  });
  it.each([
    { schemaVersion: '1', type: 'social_post' },
    { options: { theme: 'dark' } },
    { watermark: 'Forma' },
    { author: { surprise: true } },
    { translation: { model: 'GPT' } },
    { media: [{ type: 'image' }] },
    { media: [{ url: 'ftp://example.com/private.png' }] },
    { quotedPost: { postKind: 'quote' } },
    { reshare: { by: {} } },
    { content: 'x'.repeat(4001) },
    { media: Array.from({ length: 13 }, () => ({ url: source('blue') })) },
  ])('rejects invalid or unknown business fields: %j', data => {
    expect(() => registry.validate('social_post', data)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
  it('loads only visible posts, prefers previews, skips audio files and retains partial success', async () => {
    const download = vi.fn(async (url: string) => {
      if (url.includes('missing')) throw new Error('Image unavailable');
      return imageBuffer(url);
    });
    const data = socialPostSchema.parse({
      author: { avatarUrl: source('red') },
      postKind: 'reply',
      media: [media[2], { type: 'audio', url: 'https://example.com/audio.mp3' }, { url: source('missing') }],
      replyChain: Array.from({ length: 11 }, (_, index) => ({ author: { avatarUrl: source('reply-' + index) } })),
      quotedPost: { author: { avatarUrl: source('hidden-quote') } },
    });
    const assets = await socialPost.assets!(data, new ImageStore(config, download));
    const urls = download.mock.calls.map(([url]) => url);
    expect(urls).toContain(source('blue'));
    expect(urls).not.toContain(media[2]!.url);
    expect(urls).not.toContain('https://example.com/audio.mp3');
    expect(urls).not.toContain(source('reply-0'));
    expect(urls).not.toContain(source('reply-1'));
    expect(urls).not.toContain(source('hidden-quote'));
    expect(assets['post-avatar']).toMatch(/^data:image\/png;base64,/);
    expect(assets['post-media-0']).toMatch(/^data:image\/png;base64,/);
    expect(assets).not.toHaveProperty('post-media-1');
    expect(assets['post-media-2']).toBeUndefined();
    expect(assets['reply-0-avatar']).toMatch(/^data:image\/png;base64,/);
  });
});

describe('social_post real Satori and Skia output', () => {
  it('shares Twitter boundaries and one highlight color across all post and translation paths', async () => {
    const text =
      '👋 #中文 #hello_world #2026go @user_01 ＠bob @abcdefghijklmno\n#123 word@alice person@example.com @abcdefghijklmnop @中文\nhttps://example.com/@user#fragment。';
    const snapshot = { content: text, translation: { text } };
    const expected = [
      '#中文',
      '#hello_world',
      '#2026go',
      '@user_01',
      '＠bob',
      '@abcdefghijklmno',
      'https://example.com/@user#fragment',
    ];
    for (const data of [
      snapshot,
      { postKind: 'reply' as const, replyChain: [snapshot] },
      { postKind: 'quote' as const, quotedPost: snapshot },
    ]) {
      const html = renderToStaticMarkup(
        socialPost.render(data, { assets: {}, fontFamily: 'sans-serif', monospaceFontFamily: 'monospace' }),
      );
      const highlighted = [...html.matchAll(/<span style="[^"]*color:#0969da[^"]*">([^<]*)<\/span>/g)].map(match =>
        decodeHTML(match[1]!),
      );
      expect(highlighted).toEqual([...expected, ...expected]);
      expect(html).not.toContain('#2563eb');
      const svg = await render(data, 'svg');
      expect(Buffer.from(svg.body).toString()).toContain('fill="#0969da"');
    }
    const result = await render(snapshot);
    expect(result.warnings).toEqual([]);
    await mkdir('artifacts/social-post', { recursive: true });
    await writeFile('artifacts/social-post/highlights.png', result.body);
  });
  it('sizes short and long text from 400 to 700px, wraps multilingual text and renders empty data', async () => {
    const empty = await render({});
    const short = await render({ content: '短文' });
    const long = await render({ content: '中文、日本語、English '.repeat(80) });
    expect(empty.layoutWidth).toBe(400);
    expect(short.layoutWidth).toBe(400);
    expect(long.layoutWidth).toBe(700);
    expect(long.height).toBeGreaterThan(short.height + 200);
    expect(short.height).toBeGreaterThan(empty.height);
    expect((await render({ content: '✨ 👩‍💻 你好 日本語 Hello' }, 'svg')).warnings).toEqual([]);
  });
  it('uses the same safe inline token styling in the main post, translation, reply and quote', async () => {
    const plain = await render({ content: '#123 #456' }, 'svg');
    expect(Buffer.from(plain.body).toString()).not.toContain('fill="' + '#0969da' + '"');
    for (const data of [
      { content: '正文 #中文 @forma https://example.com' },
      { translation: { text: '译文 #日本語 @forma https://example.com' } },
      { postKind: 'reply', replyChain: [{ content: '回复 #话题 @forma' }] },
      { postKind: 'quote', quotedPost: { content: '引用 #話題 @forma' } },
    ]) {
      const result = await render(data, 'svg');
      const svg = Buffer.from(result.body).toString();
      expect(svg).toContain('fill="#0969da"');
      expect(svg).not.toMatch(/(?:href|src)="https?:/);
      expect(svg).not.toContain('<text');
      expect(svg).not.toContain('<a ');
    }
    await expect(render({ content: '<script>alert(1)</script> **plain text**' })).resolves.toMatchObject({
      warnings: [],
    });
  });
  it('uses the same inline paragraph flow with or without highlighted tokens and preserves explicit newlines', async () => {
    for (const content of [
      '开头'.repeat(8) +
        ' #话题 ' +
        '后文'.repeat(10) +
        ' @forma\n' +
        '第二行'.repeat(6) +
        ' https://example.com/post ' +
        '结尾'.repeat(8),
      '普通正文 中文 日本語 한국어 English\n第二行没有着色标记。',
    ]) {
      const data = { content };
      const colored = await render(data, 'svg');
      const plain = await renderer.render({ template: 'test-social-plain', data, format: 'svg' });
      expect([colored.width, colored.height]).toEqual([plain.width, plain.height]);
    }
  });
  it.each(['reply', 'quote'] as const)('keeps %s media inside the shared frame padding', async postKind => {
    mockImages();
    const snapshot = { author: { name: '原作者', avatarUrl: source('green') }, media: [media[0]] };
    const result = await render({ postKind, replyChain: [snapshot], quotedPost: snapshot });
    const png = PNG.sync.read(Buffer.from(result.body));
    const xs: number[] = [];
    for (let index = 0; index < png.data.length; index += 4) {
      if (nearColor(png.data, index, [220, 30, 40])) xs.push((index / 4) % png.width);
    }
    expect(xs.length).toBeGreaterThan(100);
    // Shared frame: 12px outside + 1px border + 16px inside.
    // Replies reserve 60px for the avatar; quotes add their own 16px padding + border.
    const frameInset = 12 + 1 + 16;
    const leftInset = frameInset + (postKind === 'reply' ? 60 : 17);
    const rightInset = frameInset + (postKind === 'quote' ? 17 : 0);
    expect(xs.reduce((min, x) => Math.min(min, x), Infinity)).toBeGreaterThanOrEqual(leftInset);
    expect(xs.reduce((max, x) => Math.max(max, x), -Infinity)).toBeLessThan(result.width - rightInset);
  });
  it('renders all relation kinds and ignores inactive relation fields', async () => {
    mockImages();
    const snapshot = {
      author: { name: '原作者', handle: '@original', avatarUrl: source('blue'), verified: true },
      content: '原文',
      translation: { text: '译文' },
      media: [media[0]],
      publishedAt: '昨天',
    };
    const base = {
      author: { name: '当前作者', handle: 'current', avatarUrl: source('red') },
      content: '当前内容',
      source: 'Twitter',
      url: 'https://example.com/post',
    };
    const normal = await render(base);
    const inactive = await render({
      ...base,
      replyChain: [snapshot],
      quotedPost: snapshot,
      reshare: { by: { name: '转发者' } },
    });
    expect(inactive.body).toEqual(normal.body);
    const quote = await render({ ...base, postKind: 'quote', quotedPost: snapshot });
    const reply = await render({ ...base, postKind: 'reply', replyChain: [snapshot, snapshot] });
    const reshare = await render({
      ...base,
      postKind: 'reshare',
      reshare: { by: { name: '转发者' }, publishedAt: '今天' },
    });
    expect(quote.height).toBeGreaterThan(normal.height + 100);
    expect(reply.height).toBeGreaterThan(quote.height);
    expect(reshare.height).toBeGreaterThan(normal.height);
    const replies = Array.from({ length: 10 }, (_, index) => ({ content: '回复 ' + index }));
    const overflow = await render({ postKind: 'reply', replyChain: replies });
    const replacedHidden = await render({
      postKind: 'reply',
      replyChain: [{ content: '被隐藏的内容'.repeat(80) }, ...replies.slice(1)],
    });
    expect(replacedHidden.body).toEqual(overflow.body);
  });
  it.each(['vertical', 'grid', 'collage'] as const)(
    'renders %s media as embedded images with no remote references',
    async mediaLayout => {
      mockImages();
      const result = await render({ media, mediaLayout }, 'svg');
      const svg = Buffer.from(result.body).toString();
      expect(svg.match(/href="data:image\/png;base64,/g)?.length).toBe(3);
      expect(svg).toContain('data:image/png;base64,');
      expect(svg).not.toMatch(/(?:href|src)="https?:/);
      expect(result.warnings).toEqual([]);
      const png = await render({ media, mediaLayout });
      const decoded = PNG.sync.read(Buffer.from(png.body));
      expect([decoded.width, decoded.height]).toEqual([result.width * 2, result.height * 2]);
      const skia = await rasterize(svg, decoded.width * 2, decoded.height * 2, {
        ...config,
        maxPixels: config.maxRasterPixels,
      });
      const unquantized = PNG.sync.read(
        await sharp(skia.pixels, {
          raw: { width: skia.width, height: skia.height, channels: 4, premultiplied: true },
        })
          .resize(decoded.width, decoded.height, { kernel: 'lanczos3' })
          .png()
          .toBuffer(),
      );
      expectPngQuality(decoded.data, unquantized.data);
    },
  );
  it.each([1, 2, 3, 4, 5, 6, 12])('renders a %i-image grid without clipping the canvas', async count => {
    mockImages();
    const result = await render({
      mediaLayout: 'grid',
      media: Array.from({ length: count }, (_, index) => media[index % media.length]),
    });
    const png = PNG.sync.read(Buffer.from(result.body));
    expect(result.layoutWidth).toBe(400);
    expect(result.height).toBeGreaterThan(180);
    expect([png.width, png.height]).toEqual([result.width, result.height]);
    expectPngQuality(png.data.subarray(0, 4), [245, 245, 245, 255]);
    // Every input tile must retain visible image pixels, even in an incomplete last row.
    for (const color of [[220, 30, 40], ...(count > 1 ? [[30, 170, 70]] : []), ...(count > 2 ? [[30, 80, 220]] : [])]) {
      let matches = 0;
      for (let index = 0; index < png.data.length; index += 4) {
        if (nearColor(png.data, index, color)) matches++;
      }
      expect(matches).toBeGreaterThan(100);
    }
  });
  it('retains natural image ratios in vertical and collage layouts, with no collage gaps', async () => {
    mockImages();
    const vertical = await render({ media: media.slice(0, 2), mediaLayout: 'vertical' });
    const collage = await render({ media: media.slice(0, 2), mediaLayout: 'collage' });
    expect(vertical.height).toBeGreaterThan(collage.height + 300);
    const png = PNG.sync.read(Buffer.from(collage.body));
    const colors: string[] = [];
    for (let x = 0; x < png.width; x++) {
      const index = (80 * png.width + x) * 4;
      if (nearColor(png.data, index, [220, 30, 40])) colors.push('red');
      if (nearColor(png.data, index, [30, 170, 70])) colors.push('green');
    }
    expect(colors).toContain('red');
    expect(colors).toContain('green');
    expect(colors.length).toBeGreaterThan(250);
  });
  it('preserves successful images, warns on failures and does not download an audio-only post', async () => {
    const get = mockImages();
    const result = await render(
      {
        author: { name: '作者', avatarUrl: source('missing-avatar') },
        media: [{ url: source('red') }, { url: source('missing') }, { type: 'gif', url: source('blue') }],
      },
      'svg',
    );
    const svg = Buffer.from(result.body).toString();
    expect(result.warnings).toEqual(['IMAGE_UNAVAILABLE']);
    expect(svg.match(/<image /g)?.length).toBe(2);
    get.mockClear();
    expect((await render({ media: [{ type: 'audio', url: 'https://example.com/audio.mp3' }] })).warnings).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
  it('applies real image URL restrictions and reports a fallback instead of failing the card', async () => {
    const result = await render({ content: '正文保留', media: [{ url: 'http://127.0.0.1/private.png' }] });
    expect(result.warnings).toEqual(['IMAGE_UNAVAILABLE']);
    expect(PNG.sync.read(Buffer.from(result.body)).width).toBeGreaterThanOrEqual(400);
  });
  it.each([
    { source: '来源'.repeat(16) },
    { url: 'https://example.com/' + 'segment/'.repeat(7) },
    { source: '来源'.repeat(12), url: 'https://example.com/post/1' },
  ])('expands to fit footer metadata without premature truncation: %j', async metadata => {
    const data = { content: '简短正文', ...metadata };
    const result = await render(data, 'svg');
    expect(result.layoutWidth).toBeGreaterThan(400);
    expect(result.layoutWidth).toBeLessThan(700);
    const svg = await satori(
      CardFrame({
        children: socialPost.render(data, { assets: {}, ...fonts }),
        fontFamily: fonts.fontFamily,
        monospaceFontFamily: fonts.monospaceFontFamily,
      }),
      { fonts: fonts.fonts, width: result.layoutWidth, embedFont: false },
    );
    const text = [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(match => decodeHTML(match[1]!)).join('');
    expect(text).toContain(metadata.source ?? metadata.url);
    if (metadata.url) expect(text).toContain(metadata.url);
    expect(text).not.toContain('…');
  });
  it('caps footer-driven width at the template maximum', async () => {
    const result = await render(
      { content: '正文', source: '来源'.repeat(70), url: 'https://example.com/' + 'x'.repeat(500) },
      'svg',
    );
    expect(result.layoutWidth).toBe(700);
  });
  it('omits blank footer metadata and keeps long names and source URLs within the frame', async () => {
    const short = await render({ content: '正文' });
    expect((await render({ content: '正文', source: ' ', url: '\n' })).body).toEqual(short.body);
    const long = await render({
      author: { name: '长名称'.repeat(50), handle: 'account'.repeat(20), verified: true },
      content: '正文',
      source: '来源'.repeat(70),
      url: 'https://example.com/' + 'long-url/'.repeat(200),
    });
    expect(long.layoutWidth).toBe(700);
    expect(long.layoutHeight).toBeLessThan(400);
  });
});
