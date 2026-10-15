import { PNG } from 'pngjs';
import { createElement } from 'react';
import satori from 'satori';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { type LoadedFonts, loadFonts } from '../src/core/fonts.js';
import { rasterize } from '../src/core/rasterize.js';
import { Renderer } from '../src/core/renderer.js';
import { assertDimensions, layoutOptions, svgDimensions } from '../src/core/sizing.js';
import type { TemplateContext } from '../src/core/types.js';
import { registry } from '../src/templates/index.js';
import { expectPngQuality } from './fixtures/png-quality.js';
import { rasterPng } from './fixtures/raster-png.js';
import { registerTestTemplates } from './fixtures/templates.js';

const config = loadConfig({ LOG_LEVEL: 'silent' });
const typographySchema = z.object({
  text: z.string(),
  monospace: z.boolean().default(false),
  weight: z.union([z.literal(400), z.literal(700)]).default(400),
});
const typography = (data: z.infer<typeof typographySchema>, context: TemplateContext) =>
  createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } },
    createElement(
      'div',
      {
        'data-measure': true,
        style: {
          display: 'flex',
          whiteSpace: 'pre',
          fontSize: 20,
          fontWeight: data.weight,
          fontFamily: data.monospace ? context.monospaceFontFamily : context.fontFamily,
        },
      },
      data.text,
    ),
  );
let renderer: Renderer;
let fonts: LoadedFonts;
beforeAll(async () => {
  registerTestTemplates();
  registry.register({
    id: 'test-typography',
    name: 'Typography fixture',
    description: 'Measure and render the selected text family',
    schema: typographySchema,
    sizing: { mode: 'content', minWidth: 124, maxWidth: 760 },
    mock: { text: 'Hello', monospace: false, weight: 400 },
    measure: typography,
    render: typography,
  });
  fonts = await loadFonts(config.fontConfig);
  renderer = new Renderer(config, fonts);
});
const render = (data: unknown, format: 'png' | 'svg' = 'svg') =>
  renderer.render({ template: 'test-content', data, format });

describe('real Satori + Skia rendering', () => {
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
    expect(marked.layoutWidth).toBeGreaterThan(360);
    expect(marked.layoutWidth).toBeLessThanOrEqual(600);
    expect(marked.width).toBe(plain.width);
    expect(marked.height).toBeGreaterThan(plain.height);
    for (const [data] of [...content.mock.calls, ...assets.mock.calls]) expect(data).toEqual({ message });
    const png = PNG.sync.read(Buffer.from(marked.body));
    const pixel = (x: number, y: number) => [
      ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    ];
    expect(pixel(0, 0)).toEqual([245, 245, 245, 255]);
    expect(pixel(70, 30)).toEqual([255, 255, 255, 255]);
    expectPngQuality(pixel(140, 25), [227, 232, 238, 255]);
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
    expect(result.layoutHeight).toBe(240);
    if (mode === 'fixed') expect(result.layoutWidth).toBe(360);
    else {
      expect(result.layoutWidth).toBeGreaterThan(122);
      expect(result.layoutWidth).toBeLessThan(360);
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
  it('renders mixed Chinese, Japanese, Korean, Latin and local color emoji without external references', async () => {
    const result = await render({
      title: '你好、世界 Hello ✨',
      body: '中文测试 繁體中文 日本語 かな カナ 한국어 한글 café ⏻ 🎉 👩‍💻 🇯🇵',
    });
    const svg = Buffer.from(result.body).toString();
    expect(svg).toContain('<path');
    expect(svg).toContain('data:image/svg+xml;base64,');
    expect(svg).not.toMatch(/(?:href|src)="https?:/);
    expect(svg).not.toContain('<text');
  });
  it.each([400, 700])('keeps Maple CN ASCII, Chinese and kana on monospace cells at weight %s', async weight => {
    const probe = (text: string, monospace = true) =>
      renderer.render({ template: 'test-typography', data: { text, monospace, weight }, format: 'svg' });
    const sizes = await Promise.all(['iiiiiiii', 'WWWWWWWW', '中文中文', 'かなかな'].map(text => probe(text)));
    // Eight ASCII cells and four full-width cells must occupy the same width.
    expect(new Set(sizes.map(result => result.width)).size).toBe(1);
    expect(sizes[0]!.width).toBeGreaterThan(124);
    // Keep probes above the template's minimum width after shrinking the frame.
    const singleAscii = await probe('AAAAAAAA');
    const singleCjk = await probe('AAAAAAA中');
    const doubleAscii = await probe('AAAAAAAAA');
    expect(singleCjk.width).toBe(doubleAscii.width);
    expect(singleCjk.width - singleAscii.width).toBe(12);
    const narrowBody = await probe('iiiiiiii', false);
    const wideBody = await probe('WWWWWWWW', false);
    expect(narrowBody.width).toBeLessThan(wideBody.width);
    expect(narrowBody.width).not.toBe(sizes[0]!.width);
  });
  it.each([false, true])(
    'renders the production text example in monospace=%s with all four languages',
    async monospace => {
      const data = {
        text: '简体中文 繁體中文\n日本語 ひらがな カタカナ\nHello café 0123456789\n한국어 한글\n㐀㐁 ⏻',
        monospace,
      };
      const svg = await renderer.render({ template: 'example', data, format: 'svg' });
      const png = await renderer.render({ template: 'example', data, format: 'png' });
      expect(Buffer.from(svg.body).toString()).not.toMatch(/(?:href|src)="https?:/);
      const image = PNG.sync.read(Buffer.from(png.body));
      expect([image.width, image.height]).toEqual([svg.width * 2, svg.height * 2]);
      expect(image.data.some(byte => byte < 100)).toBe(true);
    },
  );
  it.each([false, true])('keeps the dedicated Egyptian fallback ahead of Ancient in monospace=%s', async monospace => {
    const family = 'Noto Sans Egyptian Hieroglyphs';
    expect(fonts.fontFamily.endsWith('Noto Sans Symbols 2, ' + family + ', Go Noto Ancient')).toBe(true);
    expect(fonts.monospaceFontFamily.endsWith('Noto Sans Symbols 2, ' + family + ', Go Noto Ancient')).toBe(true);
    const previous = new Renderer(config, {
      fonts: fonts.fonts.filter(font => font.name !== 'Go Noto Ancient'),
      fontFamily: fonts.fontFamily.replace(', Go Noto Ancient', ''),
      monospaceFontFamily: fonts.monospaceFontFamily.replace(', Go Noto Ancient', ''),
    });
    const request = {
      template: 'example',
      data: { text: '中文 日本語 한국어 Hello ⏻ 🎉', monospace },
      format: 'svg' as const,
    };
    const before = await previous.render(request);
    const after = await renderer.render(request);
    expect(after.body).toEqual(before.body);
    const egyptian = { ...request, data: { text: '中文 Hello 𓀀 𓂀 𓆣 𓋹', monospace } };
    const svg = await renderer.render(egyptian);
    expect(svg.warnings).toEqual([]);
    expect(svg.body).toEqual((await previous.render(egyptian)).body);
    const source = Buffer.from(svg.body).toString();
    expect(source).toContain('<path');
    expect(source).not.toContain('<text');
    expect(source).not.toMatch(/(?:href|src)="https?:/);
    const png = await renderer.render({ ...egyptian, format: 'png' });
    const image = PNG.sync.read(Buffer.from(png.body));
    expect([image.width, image.height]).toEqual([svg.width * 2, svg.height * 2]);
    expect(image.data.some(byte => byte < 100)).toBe(true);
  });

  it.each([false, true])('uses Ancient for uncovered historical scripts in monospace=%s', async monospace => {
    const previous = new Renderer(config, {
      fonts: fonts.fonts.filter(font => font.name !== 'Go Noto Ancient'),
      fontFamily: fonts.fontFamily.replace(', Go Noto Ancient', ''),
      monospaceFontFamily: fonts.monospaceFontFamily.replace(', Go Noto Ancient', ''),
    });
    const data = { text: '中文 Hello 𖤐 𒀀 𐎀 𐌰', monospace, weight: 700 };
    const request = { template: 'test-typography', data, format: 'svg' as const };
    const before = await previous.render(request);
    expect(before.warnings).toEqual(['MISSING_GLYPH']);
    const svg = await renderer.render(request);
    expect(svg.warnings).toEqual([]);
    expect(svg.body).not.toEqual(before.body);
    expect(Buffer.from(svg.body).toString()).not.toContain('<text');
    const png = await renderer.render({ ...request, format: 'png' });
    expect(png.warnings).toEqual([]);
    const image = PNG.sync.read(Buffer.from(png.body));
    expect([image.width, image.height]).toEqual([svg.width * 2, svg.height * 2]);
    expect(image.data.some(byte => byte < 100)).toBe(true);
  });

  it.each([false, true])('renders missing glyphs during measurement in monospace=%s', async monospace => {
    const request = {
      template: 'test-typography',
      data: { text: '中文 A\u{10ffff}B\u{10fffe}C', monospace },
      watermark: 'Missing \u{10ffff}',
    };
    const svg = await renderer.render({ ...request, format: 'svg' });
    const png = await renderer.render({ ...request, format: 'png' });
    expect(svg.warnings).toEqual(['MISSING_GLYPH']);
    expect(png.warnings).toEqual(svg.warnings);
    expect([png.width, png.height]).toEqual([svg.width * 2, svg.height * 2]);
    expect(Buffer.from(svg.body).toString()).toContain('<path');
    expect(PNG.sync.read(Buffer.from(png.body)).width).toBe(png.width);
  });
  it('keeps the flat rounded card inside the PNG canvas', async () => {
    const result = await render({ title: '扁平卡片', body: '卡片外围保留紧凑留白。' }, 'png');
    const png = PNG.sync.read(Buffer.from(result.body));
    const pixel = (x: number, y: number) => [
      ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    ];
    expect([png.width, png.height]).toEqual([result.width, result.height]);
    expect(pixel(0, 0)).toEqual([245, 245, 245, 255]);
    expect(pixel(png.width - 1, 0)).toEqual(pixel(0, 0));
    expect(pixel(70, 30)).toEqual([255, 255, 255, 255]);
    // Both sides of the card end before the canvas edge (regression: content-box clipping).
    expect(pixel(2, Math.floor(png.height / 2))).toEqual(pixel(png.width - 3, Math.floor(png.height / 2)));
    expect(pixel(png.width - 3, Math.floor(png.height / 2))![0]).toBeLessThan(255);
    // The outer margin stays flat immediately below the card.
    expect(pixel(Math.floor(png.width / 2), png.height - 12)).toEqual([245, 245, 245, 255]);
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
      const cardEnd = (plain.height - 12) * plain.width * 4;
      expectPngQuality(after.data.subarray(0, cardEnd), before.data.subarray(0, cardEnd));
      // Find watermark coverage against the 245 background. A 190 cutoff can
      // miss all antialiased/quantized pixels.
      const ink: number[] = [];
      for (let y = plain.height - 12; y < after.height; y++) {
        for (let x = 0; x < after.width; x++) {
          if (after.data[(y * after.width + x) * 4]! < 225) ink.push(x);
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
    const sampled = await rasterPng(
      await rasterize(Buffer.from(svg.body).toString(), png.width * 2, png.height * 2, config),
    );
    const expected = await sharp(sampled).resize(png.width, png.height, { kernel: 'lanczos3' }).png().toBuffer();
    const decoded = PNG.sync.read(Buffer.from(png.body));
    const raster = PNG.sync.read(expected);
    expect([decoded.width, decoded.height]).toEqual([raster.width, raster.height]);
    expectPngQuality(decoded.data, raster.data);
    expect(png.width).toBe(1240);
  });
  it('checks final output limits before rasterization', async () => {
    const request = { template: 'test-auto-height', data: { title: 'Output limit' }, format: 'png' as const };
    const original = await renderer.render(request);
    const limited = new Renderer({ ...config, maxPixels: original.width * original.height - 1 }, fonts);
    await expect(limited.render(request)).rejects.toMatchObject({
      code: 'SIZE_LIMIT',
      details: { width: original.width, height: original.height },
    });
    const widthLimited = new Renderer({ ...config, maxWidth: 1000 }, fonts);
    await expect(widthLimited.render(request)).rejects.toMatchObject({ code: 'SIZE_LIMIT', details: { width: 1240 } });
  });
  it('checks intermediate pixel limits before allocation, independently of output limits', async () => {
    const request = {
      template: 'test-auto-height',
      data: { title: 'Intermediate limit' },
      format: 'png' as const,
    };
    const svg = await renderer.render({ ...request, format: 'svg' });
    const pixels = svg.width * svg.height * 16;
    const limited = new Renderer({ ...config, maxRasterPixels: pixels - 1 }, fonts);
    await expect(limited.render(request)).rejects.toMatchObject({
      code: 'SIZE_LIMIT',
      details: { width: svg.width * 4, height: svg.height * 4, maxPixels: pixels - 1 },
    });
    const exact = new Renderer({ ...config, maxRasterPixels: pixels }, fonts);
    await expect(exact.render(request)).resolves.toMatchObject({
      width: svg.width * 2,
      height: svg.height * 2,
    });
    await expect(limited.render({ ...request, format: 'svg' })).resolves.toMatchObject({ scale: 1 });
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
      format: 'svg',
    });
    expect(result.width).toBe(500);
    expect(result.height).toBeGreaterThan(250);
  });
  it('supports explicit fixed sizing and constrained intrinsic auto-width', async () => {
    const node = createElement('div', { style: { display: 'flex', whiteSpace: 'nowrap', fontSize: 20 } }, 'Hello');
    const base = { fonts: fonts.fonts };
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
    expect(PNG.sync.read(Buffer.from(result.body)).width).toBe(1240);
  });
});
