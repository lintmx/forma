import { createRequire } from 'node:module';
import { createElement } from 'react';
import satori from 'satori';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { prepareEmoji } from '../src/core/emoji.js';
import { type LoadedFonts, loadFonts } from '../src/core/fonts.js';
import { rasterize } from '../src/core/rasterize.js';
import { rasterPng } from './fixtures/raster-png.js';

const config = loadConfig({ LOG_LEVEL: 'silent' });
let fonts: LoadedFonts;
beforeAll(async () => {
  fonts = await loadFonts(config.fontConfig);
});

async function renderText(
  text: string,
  {
    inline = false,
    family = fonts.fontFamily,
    direction = 'ltr',
    width = 800,
    engine = satori,
  }: { inline?: boolean; family?: string; direction?: 'ltr' | 'rtl'; width?: number; engine?: typeof satori } = {},
) {
  const tree = await prepareEmoji(
    createElement(
      'div',
      {
        style: {
          display: 'block',
          backgroundColor: 'white',
          color: 'black',
          fontSize: 36,
          lineHeight: 2,
          whiteSpace: 'pre-wrap',
          fontFamily: family,
          direction,
          height: 288,
        },
      },
      inline ? createElement('span', null, text) : text,
    ),
    () => {},
  );
  const svg = await engine(tree, { width, height: 288, fonts: fonts.fonts });
  return rasterPng(await rasterize(svg, width * 2, 576, config));
}

async function ink(png: Buffer) {
  return sharp(png)
    .flatten({ background: 'white' })
    .trim({ background: 'white', threshold: 8 })
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function expectSameInk(actual: Buffer, reference: Buffer) {
  const [a, b] = await Promise.all([ink(actual), ink(reference)]);
  expect(Math.abs(a.info.width - b.info.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(a.info.height - b.info.height)).toBeLessThanOrEqual(2);
  // Allow a one-pixel antialiasing/rounding difference at 2x. Every solid-ink
  // pixel must have matching ink nearby, in BOTH directions (no missing marks).
  for (const [source, target] of [
    [a, b],
    [b, a],
  ]) {
    let pixels = 0;
    let unmatched = 0;
    for (let y = 0; y < source!.info.height; y++)
      for (let x = 0; x < source!.info.width; x++) {
        if (source!.data[(y * source!.info.width + x) * 3]! >= 128) continue;
        pixels++;
        let match = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            if (
              tx >= 0 &&
              ty >= 0 &&
              tx < target!.info.width &&
              ty < target!.info.height &&
              target!.data[(ty * target!.info.width + tx) * 3]! < 128
            )
              match = true;
          }
        if (!match) unmatched++;
      }
    expect(pixels).toBeGreaterThan(0);
    expect(unmatched / pixels).toBeLessThan(0.03);
  }
}

async function row(png: Buffer, index: number) {
  return sharp(png)
    .extract({ left: 0, top: index * 144, width: 1600, height: 144 })
    .png()
    .toBuffer();
}

// Compare ordered ink bands so the two layout paths may use different space advances.
// Bands are split only at entirely empty columns; joining and visual order remain observable.
async function inkBands(png: Buffer) {
  const { data, info } = await sharp(png)
    .flatten({ background: 'white' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ranges: { left: number; width: number }[] = [];
  let start = -1;
  for (let x = 0; x <= info.width; x++) {
    let occupied = false;
    if (x < info.width)
      for (let y = 0; y < info.height; y++) {
        if (data[(y * info.width + x) * 3]! < 128) {
          occupied = true;
          break;
        }
      }
    if (occupied && start < 0) start = x;
    else if (!occupied && start >= 0) {
      ranges.push({ left: start, width: x - start });
      start = -1;
    }
  }
  return Promise.all(
    ranges.map(range =>
      sharp(png)
        .extract({ ...range, top: 0, height: info.height })
        .png()
        .toBuffer(),
    ),
  );
}

describe('Satori text shaping regressions', () => {
  it.each([false, true])('keeps neutral kaomoji in input order across inline and emoji paths (mono=%s)', async mono => {
    const family = mono ? fonts.monospaceFontFamily : fonts.fontFamily;
    const reference = await renderText('߹꒳\u200b߹', { family });
    for (const text of ['߹꒳\u200b߹\nEnglish', '߹꒳\u200b߹\nEnglish 🧡']) {
      await expectSameInk(await row(await renderText(text, { family, inline: true }), 0), await row(reference, 0));
    }
  });

  it('keeps the text and position arrays aligned after zero-advance marks', async () => {
    const lines = ['13. (っ ॑꒳ ॑c)', '14. (੭ु ›ω‹ )੭ु⁾⁾', '15. ( ˶ˆᗜˆ˵ )'];
    const multiline = await renderText(lines.join('\n'));
    for (const [index, line] of lines.entries()) {
      await expectSameInk(await row(multiline, index), await row(await renderText(line), 0));
    }
  });

  it('selects one font covering the base and all combining marks, even after caching the base', async () => {
    await renderText('੭');
    const actual = await renderText('੭ु');
    const reference = await renderText('੭ु', { family: 'Go Noto Current' });
    await expectSameInk(actual, reference);
    // Same base-only and marked cluster in a single engine also must not share a resolver entry.
    await expectSameInk(await renderText('੭ ੁ'), await renderText('੭ ੁ', { family: 'Go Noto Current' }));
  });

  it('positions a stacked upper mark above the preceding upper mark', async () => {
    const [single, stacked] = await Promise.all(
      ['x\u0301', 'x\u0301\u0302'].map(async text => ink(await renderText(text))),
    );
    expect(stacked!.info.height).toBeGreaterThan(single!.info.height + 8);
  });

  it.each(['ltr', 'rtl'] as const)(
    'preserves Arabic joining, Hebrew RTL and numeric order in %s paragraphs',
    async direction => {
      for (const text of ['مرحبا بالعالم 123', 'שלום עולם 123', 'English שלום עולם 123 مرحبا بالعالم']) {
        // The existing block bidi layout is the independent reference for the inline path.
        const actual = await inkBands(await renderText(text, { direction, inline: true }));
        const expected = await inkBands(await renderText(text, { direction }));
        expect(actual.length).toBe(expected.length);
        for (const [index, band] of actual.entries()) await expectSameInk(band, expected[index]!);
      }
    },
  );

  it.each(['ltr', 'rtl'] as const)('orders real RTL text around inline emoji in a %s paragraph', async direction => {
    for (const text of ['שלום עולם', 'مرحبا بالعالم']) {
      const actual = await inkBands(await renderText(text.replace(' ', ' 🧡 '), { direction, inline: true }));
      const expected = await inkBands(await renderText(text, { direction }));
      expect(actual.length).toBe(expected.length);
      for (const [index, band] of actual.entries()) await expectSameInk(band, expected[index]!);
    }
  });

  it('keeps shaping behavior identical through the CommonJS entry', async () => {
    const cjs = createRequire(import.meta.url)('satori').default as typeof satori;
    const text = '߹꒳\u200b߹\nx\u0301\u0302 ੁ\nשלום مرحبا 123 🧡';
    expect(await renderText(text, { inline: true, engine: cjs })).toEqual(await renderText(text, { inline: true }));
  });
});
