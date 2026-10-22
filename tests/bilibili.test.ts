import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { ImageStore } from '../src/core/images.js';
import { Renderer } from '../src/core/renderer.js';
import { bilibili } from '../src/templates/bilibili/index.js';
import { type BilibiliData, bilibiliSchema } from '../src/templates/bilibili/schema.js';
import { createTemplateRegistry } from '../src/templates/index.js';

let renderer: Renderer;
const context = { assets: {}, fontFamily: 'sans-serif', monospaceFontFamily: 'monospace' };
const live: BilibiliData = {
  type: 'live',
  author: { name: '晚风电台_Alan', uid: '2849102', verified: true, avatarUrl: 'https://example.com/avatar.png' },
  coverUrl: 'https://example.com/cover.png',
  category: '电台·音乐',
  title: '【沉浸吉他夜】深夜不插电弹唱与听众连麦 · 聊聊春季音乐会企划',
  live: { roomId: '2289410', status: 'live', popularity: 1842000, startedAt: '20:15', elapsed: '1时15分' },
};

beforeAll(async () => {
  const config = loadConfig({ LOG_LEVEL: 'silent' });
  renderer = new Renderer(config, await loadFonts(config.fontConfig), createTemplateRegistry());
  await mkdir('artifacts/bilibili', { recursive: true });
});
afterEach(() => vi.restoreAllMocks());

it('accepts video and live data while rejecting invalid assets, counts and statuses', () => {
  expect(bilibiliSchema.safeParse(bilibili.mock).success).toBe(true);
  expect(bilibiliSchema.safeParse(live).success).toBe(true);
  expect(bilibiliSchema.safeParse({ title: '最简卡片' }).success).toBe(true);
  for (const extra of [
    { title: ' ' },
    { type: 'article' },
    { coverUrl: 'ftp://example.com/cover.png' },
    { author: { name: '作者', avatarUrl: 'data:image/svg+xml,unsafe' } },
    { stats: { views: -1 } },
    { stats: { likes: 1.5 } },
    { live: { status: 'unknown' } },
    { watermark: 'legacy' },
  ])
    expect(bilibiliSchema.safeParse({ title: '标题', ...extra }).success).toBe(false);
});

it('formats counts, retains zero, hides missing stats and derives source links', () => {
  const html = renderToStaticMarkup(bilibili.render(bilibili.mock, context));
  expect(html).toContain('1,028.4万');
  expect(html).toContain('https://www.bilibili.com/video/BV1W44y1G7u2');
  expect(html).toContain('av993210481');
  expect(html).not.toContain('【视频简介】');
  const minimal = renderToStaticMarkup(bilibili.render({ title: '标题', aid: 123, stats: { views: 0 } }, context));
  expect(minimal).toContain('>0</div>');
  expect(minimal).not.toContain('弹幕');
  expect(minimal).not.toContain('点赞');
  expect(minimal).not.toContain('【视频简介】');
  expect(minimal).toContain('https://www.bilibili.com/video/av123');
  const counts = renderToStaticMarkup(
    bilibili.render({ title: '标题', stats: { views: 123450000, likes: '暂无数据' } }, context),
  );
  expect(counts).toContain('1.2亿');
  expect(counts).toContain('暂无数据');
});

it('shows LIVE only on air and keeps video metadata out of live cards', () => {
  for (const [status, label] of [
    ['live', '正在直播'],
    ['offline', '未开播'],
    ['replay', '轮播中'],
  ] as const) {
    const html = renderToStaticMarkup(
      bilibili.render({ ...bilibili.mock, ...live, live: { ...live.live!, status } }, context),
    );
    expect(html).toContain(label);
    expect(html).toContain('人气 184.2万');
    expect(html).toContain('https://live.bilibili.com/2289410');
    expect(html.includes('>LIVE</div>')).toBe(status === 'live');
    expect(html.includes('20:15')).toBe(status === 'live');
    expect(html).not.toContain('01:12:45');
    expect(html).not.toContain('BV1W44y1G7u2');
    expect(html).not.toContain('播放');
  }
  expect(renderToStaticMarkup(bilibili.render({ type: 'live', title: '标题' }, context))).toContain('状态未知');
});

it('uses the asset loader for covers and avatars and preserves independent failures', async () => {
  const get = vi.fn(async (url: string) => {
    if (url === 'asset:avatar') throw new Error('unavailable');
    return 'loaded-cover';
  });
  const assets = await bilibili.assets!(
    { title: '标题', coverUrl: 'cover.png', author: { name: '作者', avatarUrl: 'asset:avatar' } },
    { get },
  );
  expect(assets).toEqual({ cover: 'loaded-cover', avatar: undefined });
  expect(get.mock.calls.map(([url]) => url)).toEqual(['asset:avatar', 'cover.png']);
  get.mockClear();
  expect(await bilibili.assets!({ title: '标题' }, { get })).toEqual({});
  expect(get).not.toHaveBeenCalled();
});

it('renders video and live PNG/SVG with cropped images, badges and fixed logical width', async () => {
  const image = new PNG({ width: 320, height: 180 });
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      image.data.set(x < 160 ? [40, 100, 160, 255] : [160, 90, 40, 255], (y * image.width + x) * 4);
    }
  }
  const uri = 'data:image/png;base64,' + PNG.sync.write(image).toString('base64');
  vi.spyOn(ImageStore.prototype, 'get').mockResolvedValue(uri);
  for (const [name, data] of [
    ['video', bilibili.mock],
    ['live', live],
  ] as const) {
    const png = await renderer.render({ template: 'bilibili', data, format: 'png', watermark: 'Generated by Forma' });
    const svg = await renderer.render({ template: 'bilibili', data, format: 'svg', watermark: 'Generated by Forma' });
    expect(png.width).toBe(1200);
    expect(svg.width).toBe(600);
    expect(png.height).toBe(svg.height * 2);
    expect(png.warnings).toEqual([]);
    expect(svg.warnings).toEqual([]);
    const pixels = PNG.sync.read(Buffer.from(png.body));
    let coverPixels = 0;
    for (let i = 0; i < pixels.data.length; i += 4)
      if (Math.abs(pixels.data[i]! - 40) < 5 && Math.abs(pixels.data[i + 1]! - 100) < 5) coverPixels++;
    expect(coverPixels).toBeGreaterThan(250000);
    expect(Buffer.from(svg.body).toString()).toContain('data:image/png;base64,');
    await writeFile('artifacts/bilibili/' + name + '.png', png.body);
    await writeFile('artifacts/bilibili/' + name + '.svg', svg.body);
  }
});

it('grows for long multilingual text and renders missing or failed images', async () => {
  vi.spyOn(ImageStore.prototype, 'get').mockRejectedValue(new Error('Image unavailable'));
  const minimal = await renderer.render({ template: 'bilibili', format: 'png', data: { title: '精简卡片' } });
  expect(minimal.warnings).toEqual([]);
  const data: BilibiliData = {
    ...bilibili.mock,
    title: '中文 日本語 한국어 English 🎸 '.repeat(8),
    author: {
      name: 'LongAuthorName'.repeat(8),
      uid: '12345678901234567890',
      avatarUrl: 'https://example.com/missing.png',
      verified: true,
    },
    category: '长分区名称 LongCategory'.repeat(3),
    description: '多语言简介与换行。\n'.repeat(8) + 'https://example.com/' + 'VeryLongUnbrokenPath'.repeat(16),
  };
  const long = await renderer.render({ template: 'bilibili', data, format: 'png' });
  expect(long.height).toBeGreaterThan(minimal.height + 400);
  expect(long.width).toBe(1200);
  expect(long.warnings).toEqual(['IMAGE_UNAVAILABLE']);
  await writeFile('artifacts/bilibili/long-missing.png', long.body);
  await writeFile('artifacts/bilibili/minimal.png', minimal.body);
});

it('keeps ten description lines and folds later lines without losing link highlights', async () => {
  const results = [];
  for (const lines of [9, 10, 11, 20]) {
    const data = {
      title: '简介折叠',
      description: Array.from({ length: lines }, (_, i) => `${i + 1}. 中文 日本語 English https://example.com 🎸`).join(
        '\n',
      ),
    };
    const png = await renderer.render({ template: 'bilibili', data, format: 'png' });
    const svg = await renderer.render({ template: 'bilibili', data, format: 'svg' });
    expect(png.warnings).toEqual([]);
    expect(svg.warnings).toEqual([]);
    expect(png.height).toBe(svg.height * 2);
    expect(Buffer.from(svg.body).toString()).toContain('#0969da');
    await writeFile(`artifacts/bilibili/description-${lines}.png`, png.body);
    await writeFile(`artifacts/bilibili/description-${lines}.svg`, svg.body);
    results.push(png);
  }
  expect(results[1]!.height - results[0]!.height).toBeGreaterThanOrEqual(44);
  expect(results[1]!.height - results[0]!.height).toBeLessThanOrEqual(46);
  expect(results[2]!.height - results[1]!.height).toBe(40);
  expect(results[3]!.height).toBe(results[2]!.height);
  expect(
    PNG.sync.read(Buffer.from(results[3]!.body)).data.equals(PNG.sync.read(Buffer.from(results[2]!.body)).data),
  ).toBe(true);
  const wrapped = await renderer.render({
    template: 'bilibili',
    format: 'png',
    data: { title: '简介折叠', description: '中文 日本語 English 🎸 https://example.com/long/path '.repeat(60) },
  });
  expect(wrapped.height).toBe(results[2]!.height);
  expect(wrapped.warnings).toEqual([]);
  await writeFile('artifacts/bilibili/description-wrapped.png', wrapped.body);
});
