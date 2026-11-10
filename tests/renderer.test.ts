import { Renderer as TakumiRenderer } from '@takumi-rs/core';
import { PNG } from 'pngjs';
import { createElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { type LoadedFonts, loadFonts } from '../src/core/fonts.js';
import { ImageStore, imageAsset } from '../src/core/images.js';
import { Renderer } from '../src/core/renderer.js';
import { assertDimensions } from '../src/core/sizing.js';
import type { TemplateContext } from '../src/core/types.js';
import { createTemplateRegistry } from '../src/templates/index.js';
import { expectPngQuality } from './fixtures/png-quality.js';
import { registerTestTemplates } from './fixtures/templates.js';

const registry = createTemplateRegistry();
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
        style: {
          display: 'block',
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
  registerTestTemplates(registry);
  registry.register({
    id: 'test-typography',
    name: 'Typography fixture',
    description: 'Measure and render the selected text family',
    schema: typographySchema,
    sizing: { mode: 'content', minWidth: 124, maxWidth: 760 },
    mock: { text: 'Hello', monospace: false, weight: 400 },

    render: typography,
  });
  fonts = await loadFonts(config.fontConfig);
  renderer = new Renderer(config, fonts, registry);
});
const render = (data: unknown) => renderer.render({ template: 'test-content', data, format: 'png' });

it.each(['', ' \n\t', '👋👩🏽‍💻'])('does not report missing glyphs without visible text: %s', async text => {
  const result = await renderer.render({ template: 'test-typography', data: { text }, format: 'png' });
  expect(result.warnings).toEqual([]);
});

describe('real Takumi rendering', () => {
  it.each([false, true])(
    'keeps uploads uncached when identical remote bytes are merged, uploadFirst=%s',
    async uploadFirst => {
      const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
      const source = imageAsset(bytes, config);
      const get = vi.spyOn(ImageStore.prototype, 'get').mockResolvedValue(source);
      const draw = vi.spyOn(TakumiRenderer.prototype, 'render');
      const id = 'test-mixed-image-' + uploadFirst;
      registry.register({
        id,
        name: 'Mixed sources',
        description: 'Upload and remote resource deduplication',
        schema: z.object({}),
        mock: {},
        sizing: { mode: 'fixed', width: 100, height: 100 },
        assets: async (_data, images) => {
          const upload = await images.get('asset:upload');
          const remote = await images.get('https://example.com/image.png');
          return uploadFirst ? { upload, remote } : { remote, upload };
        },
        render: (_data, context) => createElement('img', { src: context.assets.upload!.src, width: 20, height: 20 }),
      });
      try {
        const result = await renderer.render({ template: id, data: {}, format: 'png' }, new Map([['upload', bytes]]));
        expect(result.warnings).toEqual([]);
        expect(draw.mock.calls.at(-1)?.[1]?.images).toEqual([{ ...source, cache: 'none' }]);
        expect(source.cache).toBe('auto');
      } finally {
        get.mockRestore();
        draw.mockRestore();
      }
    },
  );
  it('automatically frames and measures a new content-only template while keeping public options out of its callbacks', async () => {
    const content = vi.fn((data: { message: string }) =>
      createElement(
        'div',
        {
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
    expectPngQuality(pixel(140, 24), [227, 232, 238, 255]);
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
    expect(narrow.layoutWidth).toBeGreaterThanOrEqual(420);
    expect(narrow.layoutWidth).toBeLessThan(wide.layoutWidth);
    expect(wide.layoutWidth).toBe(760);
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
    expect(PNG.sync.read(Buffer.from(result.body)).width).toBe(result.width);
    expect(result.warnings).toEqual([]);
  });
  it.each([400, 700])('keeps Maple CN ASCII, Chinese and kana on monospace cells at weight %s', async weight => {
    const probe = (text: string, monospace = true) =>
      renderer.render({ template: 'test-typography', data: { text, monospace, weight }, format: 'png' });
    const sizes = await Promise.all(['iiiiiiii', 'WWWWWWWW', '中文中文', 'かなかな'].map(text => probe(text)));
    // Eight ASCII cells and four full-width cells must occupy the same width.
    expect(new Set(sizes.map(result => result.layoutWidth)).size).toBe(1);
    expect(sizes[0]!.layoutWidth).toBeGreaterThan(124);
    // Keep probes above the template's minimum width after shrinking the frame.
    const singleAscii = await probe('AAAAAAAA');
    const singleCjk = await probe('AAAAAAA中');
    const doubleAscii = await probe('AAAAAAAAA');
    expect(singleCjk.layoutWidth).toBe(doubleAscii.layoutWidth);
    expect(singleCjk.layoutWidth - singleAscii.layoutWidth).toBe(12);
    const narrowBody = await probe('iiiiiiii', false);
    const wideBody = await probe('WWWWWWWW', false);
    expect(narrowBody.layoutWidth).toBeLessThan(wideBody.layoutWidth);
    expect(narrowBody.layoutWidth).not.toBe(sizes[0]!.layoutWidth);
  });
  it.each([false, true])(
    'renders the production text example in monospace=%s with all four languages',
    async monospace => {
      const data = {
        text: '简体中文 繁體中文\n日本語 ひらがな カタカナ\nHello café 0123456789\n한국어 한글\n㐀㐁 ⏻',
        monospace,
      };
      const png = await renderer.render({ template: 'example', data, format: 'png' });
      const image = PNG.sync.read(Buffer.from(png.body));
      expect([image.width, image.height]).toEqual([png.layoutWidth * 2, png.layoutHeight * 2]);
      expect(image.data.some(byte => byte < 100)).toBe(true);
    },
  );
  it.each([false, true])('keeps the dedicated Egyptian fallback ahead of Ancient in monospace=%s', async monospace => {
    const family = 'Noto Sans Egyptian Hieroglyphs';
    expect(
      fonts.fontFamily.endsWith('"Noto Sans Symbols 2", "' + family + '", "Go Noto Ancient", "Go Noto Current"'),
    ).toBe(true);
    expect(
      fonts.monospaceFontFamily.endsWith(
        '"Noto Sans Symbols 2", "' + family + '", "Go Noto Ancient", "Go Noto Current"',
      ),
    ).toBe(true);
    const previous = new Renderer(
      config,
      {
        fonts: fonts.fonts.filter(font => font.name !== 'Go Noto Ancient'),
        fontFamily: fonts.fontFamily.replace(', "Go Noto Ancient"', ''),
        monospaceFontFamily: fonts.monospaceFontFamily.replace(', "Go Noto Ancient"', ''),
      },
      registry,
    );
    const request = {
      template: 'example',
      data: { text: '中文 日本語 한국어 Hello ⏻ 🎉', monospace },
      format: 'png' as const,
    };
    const before = await previous.render(request);
    const after = await renderer.render(request);
    expect(after.width).toBe(before.width);
    const egyptian = { ...request, data: { text: '中文 Hello 𓀀 𓂀 𓆣 𓋹', monospace } };
    const png = await renderer.render(egyptian);
    expect(png.warnings).toEqual([]);
    expect(png.body).toEqual((await previous.render(egyptian)).body);
    const image = PNG.sync.read(Buffer.from(png.body));
    expect([image.width, image.height]).toEqual([png.layoutWidth * 2, png.layoutHeight * 2]);
    expect(image.data.some(byte => byte < 100)).toBe(true);
  });

  it.each([false, true])('uses Ancient for uncovered historical scripts in monospace=%s', async monospace => {
    const previous = new Renderer(
      config,
      {
        fonts: fonts.fonts.filter(font => font.name !== 'Go Noto Ancient'),
        fontFamily: fonts.fontFamily.replace(', "Go Noto Ancient"', ''),
        monospaceFontFamily: fonts.monospaceFontFamily.replace(', "Go Noto Ancient"', ''),
      },
      registry,
    );
    const data = { text: '中文 Hello 𖤐 𒀀 𐎀 𐌰', monospace, weight: 700 };
    const request = { template: 'test-typography', data, format: 'png' as const };
    const before = await previous.render(request);
    expect(before.warnings).toEqual(['MISSING_GLYPH']);
    const png = await renderer.render(request);
    expect(png.warnings).toEqual([]);
    expect(png.body).not.toEqual(before.body);
    const image = PNG.sync.read(Buffer.from(png.body));
    expect([image.width, image.height]).toEqual([png.layoutWidth * 2, png.layoutHeight * 2]);
    expect(image.data.some(byte => byte < 100)).toBe(true);
  });

  it.each([false, true])(
    'fills kaomoji gaps while keeping existing text renderable in monospace=%s',
    async monospace => {
      const previous = new Renderer(
        config,
        {
          fonts: fonts.fonts.filter(font => font.name !== 'Go Noto Current'),
          fontFamily: fonts.fontFamily.replace(', "Go Noto Current"', ''),
          monospaceFontFamily: fonts.monospaceFontFamily.replace(', "Go Noto Current"', ''),
        },
        registry,
      );
      for (const weight of [400, 700]) {
        const request = {
          template: 'test-typography',
          data: { text: '߹꒳\u200b߹ (๑•̀ㅂ•́)و✧ ٩(ˊᗜˋ*)و (ง •̀_•́)ง (っ ॑꒳ ॑c)', monospace, weight },
          format: 'png' as const,
        };
        const before = await previous.render(request);
        expect(before.warnings).toEqual(['MISSING_GLYPH']);
        const png = await renderer.render(request);
        expect(png.warnings).toEqual([]);
        expect(png.body).not.toEqual(before.body);
        const image = PNG.sync.read(Buffer.from(png.body));
        expect([image.width, image.height]).toEqual([png.layoutWidth * 2, png.layoutHeight * 2]);
      }
      const request = {
        template: 'example',
        data: { text: '中文 日本語 한국어 Hello ⏻ 𓀀 𖤐 𒀀 🐶🧡 👩‍💻', monospace },
        format: 'png' as const,
      };
      const before = await previous.render(request);
      const after = await renderer.render(request);
      expect(after.warnings).toEqual([]);
      expect(after.width).toBe(before.width);
    },
  );

  it.each([false, true])('renders missing glyphs during measurement in monospace=%s', async monospace => {
    const request = {
      template: 'test-typography',
      data: { text: '中文 A\u{10ffff}B\u{10fffe}C', monospace },
      watermark: 'Missing \u{10ffff}',
    };
    const png = await renderer.render({ ...request, format: 'png' });
    expect(png.warnings).toEqual(['MISSING_GLYPH']);
    const image = PNG.sync.read(Buffer.from(png.body));
    expect([image.width, image.height]).toEqual([png.layoutWidth * 2, png.layoutHeight * 2]);
  });
  it('keeps the flat rounded card inside the PNG canvas', async () => {
    const result = await render({ title: '扁平卡片', body: '卡片外围保留紧凑留白。' });
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
      expect(wrapped.layoutWidth).toBeLessThanOrEqual(template === 'test-content' ? 760 : 620);
      expect(wrapped.height).toBeGreaterThan(marked.height);
      const limited = new Renderer({ ...config, maxHeight: plain.height }, fonts, registry);
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

  it('checks final output limits before rasterization', async () => {
    const request = { template: 'test-auto-height', data: { title: 'Output limit' }, format: 'png' as const };
    const original = await renderer.render(request);
    const limited = new Renderer({ ...config, maxPixels: original.width * original.height - 1 }, fonts, registry);
    await expect(limited.render(request)).rejects.toMatchObject({
      code: 'SIZE_LIMIT',
      details: { width: original.width, height: original.height },
    });
    const widthLimited = new Renderer({ ...config, maxWidth: 1000 }, fonts, registry);
    await expect(widthLimited.render(request)).rejects.toMatchObject({ code: 'SIZE_LIMIT', details: { width: 1240 } });
  });

  it('rejects excessive dimensions before PNG rasterization', async () => {
    const limited = new Renderer({ ...config, maxHeight: 250 }, fonts, registry);
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
    const limited = new Renderer({ ...config, maxWidth: 1000 }, fonts, registry);
    const result = await limited.render({
      template: 'test-content',
      data: { title: '长标题'.repeat(20) },
      format: 'png',
    });
    expect(result.width).toBe(1000);
    expect(result.height).toBeGreaterThan(250);
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
