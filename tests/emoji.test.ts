import { readdir } from 'node:fs/promises';
import { createElement, Fragment, isValidElement, type ReactNode } from 'react';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { additionalAsset, prepareEmoji } from '../src/core/emoji.js';
import { loadFonts } from '../src/core/fonts.js';
import { Renderer } from '../src/core/renderer.js';

function images(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(images);
  if (!isValidElement<{ children?: ReactNode; src?: string }>(node)) return [];
  return node.type === 'img' ? [node.props.src!] : images(node.props.children);
}
const config = loadConfig({ LOG_LEVEL: 'silent' });
let renderer: Renderer;
beforeAll(async () => {
  renderer = new Renderer(config, await loadFonts(config.fontConfig));
});
const render = (text: string, format: 'png' | 'svg' = 'svg') =>
  renderer.render({ template: 'example', data: { text }, format });

describe('emoji sequences and missing glyph policy', () => {
  it.each([
    '💕',
    '💕\uFE0E',
    '💕\uFE0F',
    '👩🏽‍💻',
    '🏳️‍🌈',
    '🏳‍🌈',
    '🏳️‍⚧️',
    '🫸🏽',
    '🧑🏽‍🩰',
    '1️⃣',
    '1⃣',
    '🇨🇳',
    '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
    '🙂‍↔️',
    '🐦‍🔥',
    '🫩',
    '🫪',
  ])('embeds %s as one complete image', async text => {
    const result = await render('A' + text + 'B');
    const svg = Buffer.from(result.body).toString();
    expect(svg.match(/<image\b/g)).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(svg).not.toMatch(/(?:href|src)="https?:/);
  });

  it('uses the same asset for redundant selectors and qualification variants', async () => {
    const warn = vi.fn();
    const hearts = await Promise.all(['💕', '💕\uFE0E', '💕\uFE0F'].map(text => prepareEmoji(text, warn)));
    expect(images(hearts[0])).toEqual(images(hearts[1]));
    expect(images(hearts[0])).toEqual(images(hearts[2]));
    expect(images(await prepareEmoji('🏳️‍🌈', warn))).toEqual(images(await prepareEmoji('🏳‍🌈', warn)));
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps supported text presentation and ordinary symbols as font glyphs', async () => {
    const text = await render('A © ™ ❤ ❤︎ ☀︎ B');
    expect(Buffer.from(text.body).toString()).not.toContain('<image');
    const emoji = await render('A ©️ ™️ ❤️ ☀️ B');
    expect(
      Buffer.from(emoji.body)
        .toString()
        .match(/<image\b/g),
    ).toHaveLength(4);
    expect(text.warnings).toEqual([]);
  });

  it('handles every bundled Unicode emoji SVG sequence without splitting modifiers or ZWJ chains', async () => {
    const warn = vi.fn();
    const files = (await readdir('emoji/svg')).filter(file => file.endsWith('.svg'));
    expect(files).toHaveLength(4009);
    for (const file of files) {
      // Upstream also ships legacy private-use graphics, not Unicode emoji.
      if (/^e[0-9a-f]{3}\.svg$/.test(file)) continue;
      const text = String.fromCodePoint(
        ...file
          .slice(0, -4)
          .split('-')
          .map(part => Number.parseInt(part, 16)),
      );
      // Explicit emoji presentation also exercises text-default singleton symbols.
      const input = Array.from(text).length === 1 ? text + '\uFE0F' : text;
      const prepared = images(await prepareEmoji(input, warn));
      expect(prepared, file).toHaveLength(1);
      expect(warn, file).not.toHaveBeenCalled();
    }
  });

  it('resolves function components and fragments without rewriting attributes', async () => {
    const warn = vi.fn();
    const Content = () => createElement(Fragment, null, '中文 💕︎ ', createElement('span', { title: '🏳️‍🌈' }, '🏳️‍🌈'));
    const output = await prepareEmoji(createElement(Content), warn);
    expect(images(output)).toHaveLength(2);
    const img = createElement('img', { src: 'https://example.com/💕.png', alt: '💕' });
    expect(await prepareEmoji(img, warn)).toBe(img);
  });

  it.each(['svg', 'png'] as const)('continues %s rendering with one warning and visible placeholders', async format => {
    const result = await render('中文 A😀‍🚀B\n日本語 C\u{1FAFF}D\n正常 💕︎', format);
    expect(result.warnings).toEqual(['EMOJI_UNAVAILABLE']);
    if (format === 'png') {
      const png = await sharp(result.body).metadata();
      expect([png.width, png.height]).toEqual([result.width, result.height]);
    } else {
      const svg = Buffer.from(result.body).toString();
      expect(svg.match(/<image\b/g)).toHaveLength(3);
      expect(svg).toContain('<path');
    }
    const clean = await render('正常 💕︎', format);
    expect(clean.warnings).toEqual([]);
  });

  it('keeps ordinary missing text strict even beside an unsupported emoji', async () => {
    await expect(render('😀‍🚀\u{10FFFF}')).rejects.toMatchObject({ code: 'MISSING_GLYPH' });
    await expect(additionalAsset('unknown', '\u{10FFFF}')).rejects.toMatchObject({ code: 'MISSING_GLYPH' });
    await expect(additionalAsset('emoji', '\u{10FFFF}')).rejects.toMatchObject({ code: 'MISSING_GLYPH' });
  });

  it('shares sequence handling with intrinsic measurement, nested content and watermark', async () => {
    const request = {
      template: 'social_post',
      data: { author: { name: '作者 💕︎' }, content: '中文 🫸🏽 🏳️‍🌈 🧑🏽‍🩰\n' + '長い文章 💕︎ '.repeat(30) },
      watermark: 'Generated 🫪 😀‍🚀',
    };
    const svg = await renderer.render({ ...request, format: 'svg' });
    const png = await renderer.render({ ...request, format: 'png' });
    expect([png.width, png.height]).toEqual([svg.width * 2, svg.height * 2]);
    expect(svg.warnings).toEqual(['EMOJI_UNAVAILABLE']);
    expect(png.warnings).toEqual(svg.warnings);
    expect(svg.width).toBeLessThanOrEqual(700);
  });
});
