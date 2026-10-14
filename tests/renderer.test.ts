import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { createElement } from 'react';
import satori, { type Font } from 'satori';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { additionalAsset } from '../src/core/emoji.js';
import { loadFonts } from '../src/core/fonts.js';
import { Renderer } from '../src/core/renderer.js';
import { assertDimensions, layoutOptions, svgDimensions } from '../src/core/sizing.js';
import { registry } from '../src/templates/index.js';
import { expectPngQuality } from './fixtures/png-quality.js';
import { registerTestTemplates } from './fixtures/templates.js';

const config = loadConfig({ LOG_LEVEL: 'silent' });
let renderer: Renderer;
let fonts: Font[];
beforeAll(async () => {
  registerTestTemplates();
  fonts = await loadFonts(config.fontConfig);
  renderer = new Renderer(config, fonts);
});
const render = (data: unknown, format: 'png' | 'svg' = 'svg') =>
  renderer.render({ template: 'test-content', data, format });

describe('real Satori + resvg rendering', () => {
  it('automatically frames and measures a new content-only template while keeping public options out of its callbacks', async () => {
    const content = vi.fn((data: { message: string }) =>
      createElement(
        'div',
        {
          'data-measure': true,
          style: { display: 'flex', fontSize: 20, whiteSpace: 'pre' },
        },
        data.message,
      ),
    );
    const assets = vi.fn(async (_data: { message: string }) => ({}));
    registry.register({
      id: 'content-only-test',
      name: '内容模板',
      description: '无需外框代码',
      schema: z.object({ message: z.string() }).strict(),
      sizing: { mode: 'content', minWidth: 360, maxWidth: 600 },
      mock: { message: 'Example' },
      render: content,
      measure: content,
      assets,
    });
    const message = 'M'.repeat(20);
    const plain = await renderer.render({
      template: 'content-only-test',
      data: { message },
      format: 'png',
    });
    const marked = await renderer.render({
      template: 'content-only-test',
      data: { message },
      watermark: 'Test watermark',
      format: 'png',
    });
    expect(marked.width).toBeGreaterThan(360);
    expect(marked.width).toBeLessThanOrEqual(600);
    expect(marked.width).toBe(plain.width);
    expect(marked.height).toBeGreaterThan(plain.height);
    for (const [data] of [...content.mock.calls, ...assets.mock.calls]) expect(data).toEqual({ message });
    const png = PNG.sync.read(Buffer.from(marked.body));
    const pixel = (x: number, y: number) => [
      ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    ];
    expect(pixel(0, 0)).toEqual([245, 245, 245, 255]);
    expect(pixel(70, 40)).toEqual([255, 255, 255, 255]);
    expectPngQuality(pixel(70, 28), [227, 232, 238, 255]);
  });
  it.each(['fixed', 'auto-width'] as const)('includes the common frame with %s sizing', async mode => {
    const id = 'frame-' + mode;
    registry.register({
      id,
      name: id,
      description: '受约束尺寸的内容模板',
      schema: z.object({ message: z.string() }).strict(),
      sizing: mode === 'fixed' ? { mode, width: 360, height: 240 } : { mode, height: 240 },
      mock: { message: 'Hello' },
      render: data =>
        createElement('div', { style: { display: 'flex', whiteSpace: 'nowrap', fontSize: 20 } }, data.message),
    });
    const result = await renderer.render({
      template: id,
      data: { message: 'Hello' },
      watermark: 'Test watermark',
      format: 'png',
    });
    expect(result.height).toBe(240);
    if (mode === 'fixed') expect(result.width).toBe(360);
    else {
      expect(result.width).toBeGreaterThan(122);
      expect(result.width).toBeLessThan(360);
    }
  });
  it('uses measured glyph widths, not character count, to choose content width', async () => {
    const narrow = await render({ title: 'i'.repeat(40) });
    const wide = await render({ title: 'W'.repeat(40) });
    expect(narrow.width).toBeGreaterThanOrEqual(420);
    expect(narrow.width).toBeLessThan(wide.width);
    expect(wide.width).toBe(760);
    expect(wide.height).toBeGreaterThan(narrow.height);
  });
  it('grows naturally for wrapping text, explicit newlines and list rows', async () => {
    const short = await render({ title: '通知', body: '一行正文' });
    const paragraphs = await render({
      title: '通知',
      body: '一行正文\n'.repeat(20),
    });
    const list = await render({
      title: '通知',
      rows: Array(15).fill('自适应列表 · リスト · item'),
    });
    expect(paragraphs.height).toBeGreaterThan(short.height + 300);
    expect(list.height).toBeGreaterThan(short.height + 300);
  });
  it('renders mixed Chinese, Japanese, Latin and local color emoji without external references', async () => {
    const result = await render({
      title: '你好、世界 Hello ✨',
      body: '中文测试 日本語 かな カナ café 🎉 👩‍💻 🇯🇵',
    });
    const svg = Buffer.from(result.body).toString();
    expect(svg).toContain('<path');
    expect(svg).toContain('data:image/svg+xml;base64,');
    expect(svg).not.toMatch(/(?:href|src)="https?:/);
    expect(svg).not.toContain('<text');
  });
  it('reports missing glyphs rather than silently returning tofu', async () => {
    await expect(render({ title: '\u{10ffff}' })).rejects.toMatchObject({
      code: 'MISSING_GLYPH',
    });
    await expect(additionalAsset('emoji', '\u{10ffff}')).rejects.toMatchObject({
      code: 'MISSING_GLYPH',
    });
  });
  it('keeps the rounded card and its shadow inside the PNG canvas', async () => {
    const result = await render({ title: '卡片圆角与阴影', body: '阴影应保留在画布内部。' }, 'png');
    const png = PNG.sync.read(Buffer.from(result.body));
    const pixel = (x: number, y: number) => [
      ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    ];
    expect([png.width, png.height]).toEqual([result.width, result.height]);
    expect(pixel(0, 0)).toEqual([245, 245, 245, 255]);
    expect(pixel(png.width - 1, 0)).toEqual(pixel(0, 0));
    expect(pixel(70, 40)).toEqual([255, 255, 255, 255]);
    // Both sides of the card end before the canvas edge (regression: content-box clipping).
    expect(pixel(2, Math.floor(png.height / 2))).toEqual(pixel(png.width - 3, Math.floor(png.height / 2)));
    expect(pixel(png.width - 3, Math.floor(png.height / 2))![0]).toBeLessThan(255);
    // Soft shadow darkens pixels just below the card but outside its border.
    const shadow = pixel(Math.floor(png.width / 2), png.height - 23);
    expect(shadow[0]).toBeLessThan(245);
    expect(shadow[0]).toBeGreaterThan(210);
  });
  it.each(['test-content', 'test-auto-height'])(
    'renders an optional, centered watermark below %s while preserving the card layout',
    async template => {
      const data = { title: '更新', body: '中文・日本語・English' };
      const plain = await renderer.render({ template, data, format: 'png' });
      const marked = await renderer.render({
        template,
        data,
        watermark: 'Generated by Forma',
        format: 'png',
      });
      const blank = await renderer.render({
        template,
        data,
        watermark: ' \n\t ',
        format: 'png',
      });
      const trimmed = await renderer.render({
        template,
        data,
        watermark: '  Generated by Forma  ',
        format: 'png',
      });
      expect(trimmed.body).toEqual(marked.body);
      expect(blank.body).toEqual(plain.body);
      expect(marked.width).toBe(plain.width);
      expect(marked.height).toBeGreaterThan(plain.height);
      const before = PNG.sync.read(Buffer.from(plain.body));
      const after = PNG.sync.read(Buffer.from(marked.body));
      const cardEnd = (plain.height - 28) * plain.width * 4;
      expectPngQuality(after.data.subarray(0, cardEnd), before.data.subarray(0, cardEnd));
      // Find actual watermark glyphs below the card, excluding its soft shadow.
      const ink: number[] = [];
      for (let y = plain.height - 12; y < after.height; y++) {
        for (let x = 0; x < after.width; x++) {
          if (after.data[(y * after.width + x) * 4]! < 190) ink.push(x);
        }
      }
      expect(ink.length).toBeGreaterThan(0);
      expect(Math.abs((Math.min(...ink) + Math.max(...ink)) / 2 - (after.width - 1) / 2)).toBeLessThan(3);
      const wrapped = await renderer.render({
        template,
        data,
        watermark: '由 MagiBot 生成・日本語・English '.repeat(6),
        format: 'png',
      });
      expect(wrapped.width).toBe(plain.width);
      expect(wrapped.height).toBeGreaterThan(marked.height);
      const limited = new Renderer({ ...config, maxHeight: plain.height }, fonts);
      await expect(
        limited.render({
          template,
          data,
          watermark: 'Generated by Forma',
          format: 'png',
        }),
      ).rejects.toMatchObject({ code: 'SIZE_LIMIT' });
    },
  );
  it('produces PNG with identical dimensions and bounded color error against the returned SVG', async () => {
    const request = {
      template: 'test-auto-height',
      data: registry.get('test-auto-height').mock,
      watermark: 'Generated by Forma',
    };
    const png = await renderer.render({ ...request, format: 'png' });
    const svg = await renderer.render({ ...request, format: 'svg' });
    const expected = new Resvg(Buffer.from(svg.body), {
      font: { loadSystemFonts: false },
    })
      .render()
      .asPng();
    const decoded = PNG.sync.read(Buffer.from(png.body));
    const raster = PNG.sync.read(expected);
    expect([decoded.width, decoded.height]).toEqual([raster.width, raster.height]);
    expectPngQuality(decoded.data, raster.data);
    expect(png.width).toBe(620);
  });
  it.each([2, 3, 4])(
    'rasterizes the unchanged SVG at %sx, preserving layout while increasing output resolution',
    async scale => {
      const request = {
        template: 'test-auto-height',
        data: registry.get('test-auto-height').mock,
        watermark: 'Generated by Forma',
      };
      const original = await renderer.render({ ...request, format: 'png' });
      const scaled = await renderer.render({
        ...request,
        format: 'png',
        scale,
      });
      const svg = await renderer.render({ ...request, format: 'svg', scale });
      const png = PNG.sync.read(Buffer.from(scaled.body));
      expect([png.width, png.height]).toEqual([original.width * scale, original.height * scale]);
      expect([scaled.width, scaled.height]).toEqual([png.width, png.height]);
      expect([scaled.layoutWidth, scaled.layoutHeight]).toEqual([original.width, original.height]);
      const expected = new Resvg(Buffer.from(svg.body), {
        font: { loadSystemFonts: false },
        fitTo: { mode: 'zoom', value: scale },
      })
        .render()
        .asPng();
      const raster = PNG.sync.read(expected);
      expect([png.width, png.height]).toEqual([raster.width, raster.height]);
      expectPngQuality(png.data, raster.data);
      const unscaledSvg = await renderer.render({ ...request, format: 'svg' });
      expect(svg.body).toEqual(unscaledSvg.body);
      expect(svg.scale).toBe(1);
    },
  );
  it('checks actual scaled pixel counts and dimensions before rasterization', async () => {
    const request = {
      template: 'test-auto-height',
      data: registry.get('test-auto-height').mock,
      watermark: 'Generated by Forma',
      format: 'png' as const,
    };
    const original = await renderer.render(request);
    const limited = new Renderer({ ...config, maxPixels: original.width * original.height * 3 }, fonts);
    await expect(limited.render(request)).resolves.toMatchObject({ width: 620 });
    await expect(limited.render({ ...request, scale: 2 })).rejects.toMatchObject({
      code: 'SIZE_LIMIT',
      details: { width: original.width * 2, height: original.height * 2 },
    });
    const widthLimited = new Renderer({ ...config, maxWidth: 1600 }, fonts);
    await expect(widthLimited.render({ ...request, scale: 3 })).rejects.toMatchObject({
      code: 'SIZE_LIMIT',
      details: { width: 1860 },
    });
  });
  it('rejects excessive dimensions before PNG rasterization', async () => {
    const limited = new Renderer({ ...config, maxHeight: 250 }, fonts);
    await expect(
      limited.render({
        template: 'test-content',
        data: { title: '太长', rows: Array(20).fill('内容') },
        format: 'png',
      }),
    ).rejects.toMatchObject({ code: 'SIZE_LIMIT' });
    expect(() =>
      assertDimensions(1000, 1000, {
        maxWidth: 1600,
        maxHeight: 4096,
        maxPixels: 100,
      }),
    ).toThrow();
  });
  it('caps content width to the service limit and lays out the text at that width', async () => {
    const limited = new Renderer({ ...config, maxWidth: 500 }, fonts);
    const result = await limited.render({
      template: 'test-content',
      data: { title: '长标题'.repeat(20) },
      format: 'png',
    });
    expect(result.width).toBe(500);
    expect(result.height).toBeGreaterThan(250);
  });
  it('supports explicit fixed sizing and constrained intrinsic auto-width', async () => {
    const node = createElement('div', { style: { display: 'flex', whiteSpace: 'nowrap', fontSize: 20 } }, 'Hello');
    const base = { fonts };
    const fixed = await layoutOptions({ mode: 'fixed', width: 300, height: 100 }, undefined, base, config);
    expect(svgDimensions(await satori(node, { ...base, ...fixed }))).toEqual({
      width: 300,
      height: 100,
    });
    const auto = await layoutOptions({ mode: 'auto-width', height: 100 }, undefined, base, config);
    const output = svgDimensions(await satori(node, { ...base, ...auto }));
    expect(output.height).toBe(100);
    expect(output.width).toBeGreaterThan(30);
    expect(output.width).toBeLessThan(300);
  });
  it('preserves content when an image is unavailable and signals the fallback', async () => {
    const result = await renderer.render({
      template: 'test-auto-height',
      data: { title: '测试', image: 'http://127.0.0.1/private' },
      format: 'png',
    });
    expect(result.warnings).toEqual(['IMAGE_UNAVAILABLE']);
    expect(PNG.sync.read(Buffer.from(result.body)).width).toBe(620);
  });
});
