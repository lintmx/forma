import { readdir } from 'node:fs/promises';
import type { ImageSource, Node } from '@takumi-rs/core';
import { fromJsx } from '@takumi-rs/helpers/jsx';
import { PNG } from 'pngjs';
import { createElement, Fragment, type ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { prepareEmoji } from '../src/core/emoji.js';
import { loadFonts } from '../src/core/fonts.js';
import { Renderer } from '../src/core/renderer.js';
import { createTemplateRegistry } from '../src/templates/index.js';

function images(node: Node): string[] {
  return node.type === 'image'
    ? [String(node.src)]
    : node.type === 'container'
      ? (node.children ?? []).flatMap(images)
      : [];
}
async function prepare(value: ReactNode, warn: () => void) {
  const { node } = await fromJsx(createElement('span', null, value));
  return prepareEmoji(node, warn, new Map<string, ImageSource>());
}
const registry = createTemplateRegistry();
const config = loadConfig({ LOG_LEVEL: 'silent' });
let renderer: Renderer;
beforeAll(async () => {
  renderer = new Renderer(config, await loadFonts(config.fontConfig), registry);
});
const render = (text: string) => renderer.render({ template: 'example', data: { text }, format: 'png' });

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
    expect(images(await prepare('A' + text + 'B', () => {}))).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('uses the same asset for redundant selectors and qualification variants', async () => {
    const warn = vi.fn();
    const hearts = await Promise.all(['💕', '💕\uFE0E', '💕\uFE0F'].map(text => prepare(text, warn)));
    expect(images(hearts[0]!)).toEqual(images(hearts[1]!));
    expect(images(hearts[0]!)).toEqual(images(hearts[2]!));
    expect(images(await prepare('🏳️‍🌈', warn))).toEqual(images(await prepare('🏳‍🌈', warn)));
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps supported text presentation and ordinary symbols as font glyphs', async () => {
    const text = await render('A © ™ ❤ ❤︎ ☀︎ B');
    expect(images(await prepare('A © ™ ❤ ❤︎ ☀︎ B', () => {}))).toHaveLength(0);
    expect(images(await prepare('A ©️ ™️ ❤️ ☀️ B', () => {}))).toHaveLength(4);
    expect((await render('A ©️ ™️ ❤️ ☀️ B')).warnings).toEqual([]);
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
      const prepared = images(await prepare(input, warn));
      expect(prepared, file).toHaveLength(1);
      expect(warn, file).not.toHaveBeenCalled();
    }
  });

  it('resolves function components and fragments without rewriting attributes', async () => {
    const warn = vi.fn();
    const Content = () => createElement(Fragment, null, '中文 💕︎ ', createElement('span', { title: '🏳️‍🌈' }, '🏳️‍🌈'));
    const output = await prepare(createElement(Content), warn);
    expect(images(output)).toHaveLength(2);
    const img = createElement('img', { src: 'https://example.com/💕.png', alt: '💕' });
    expect(images(await prepare(img, warn))).toEqual(['https://example.com/💕.png']);
  });

  it('continues PNG rendering with one warning and visible placeholders', async () => {
    const result = await render('中文 A😀‍🚀B\n日本語 C\u{1FAFF}D\n正常 💕︎');
    expect(result.warnings).toEqual(['EMOJI_UNAVAILABLE']);
    const png = PNG.sync.read(Buffer.from(result.body));
    expect([png.width, png.height]).toEqual([result.width, result.height]);
    const clean = await render('正常 💕︎');
    expect(clean.warnings).toEqual([]);
  });

  it('renders missing text beside unsupported emoji in PNG', async () => {
    const result = await render('中文 A😀‍🚀B\u{10FFFF}C\u{10FFFE}D\u{10FFFF}');
    expect(result.warnings).toEqual(['EMOJI_UNAVAILABLE', 'MISSING_GLYPH']);
    expect(result.body.byteLength).toBeGreaterThan(0);
    expect((await render('中文 正常 💕︎')).warnings).toEqual([]);
  });

  it('shares sequence handling with intrinsic measurement, nested content and watermark', async () => {
    const request = {
      template: 'social_post',
      data: { author: { name: '作者 💕︎' }, content: '中文 \u{10FFFF} 🫸🏽 🏳️‍🌈 🧑🏽‍🩰\n' + '長い文章 💕︎ '.repeat(30) },
      watermark: 'Generated 🫪 😀‍🚀 \u{10FFFE}',
    };
    const png = await renderer.render({ ...request, format: 'png' });
    const decoded = PNG.sync.read(Buffer.from(png.body));
    expect([decoded.width, decoded.height]).toEqual([png.layoutWidth * 2, png.layoutHeight * 2]);
    expect(png.warnings.toSorted()).toEqual(['EMOJI_UNAVAILABLE', 'MISSING_GLYPH']);
    expect(png.layoutWidth).toBeLessThanOrEqual(700);
  });
});

it('keeps multiline text aligned after inserting inline Emoji', async () => {
  const plain = await render('Alpha\nAlpha\nAlpha');
  const result = await render('Alpha 😀\nAlpha 🧡\nAlpha');
  expect(result.height).toBe(plain.height);
  expect(result.warnings).toEqual([]);
  const { data, width } = PNG.sync.read(Buffer.from(result.body));
  const starts = [0, 1, 2].map(line => {
    let left = width;
    for (let y = Math.ceil(57 + line * 51.2); y < Math.floor(57 + (line + 1) * 51.2); y++)
      for (let x = 40; x < width - 40; x++) {
        const offset = (y * width + x) * 4;
        if (data[offset]! < 100 && data[offset + 1]! < 110 && data[offset + 2]! < 120) left = Math.min(left, x);
      }
    return left;
  });
  expect(starts[0]).toBeLessThan(65);
  expect(new Set(starts).size).toBe(1);
});
