import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isValidElement, type ReactNode } from 'react';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { svgForSkia } from '../src/core/svg-for-skia.js';

vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, readFile: vi.fn(fs.readFile), readdir: vi.fn(fs.readdir) };
});
const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const twemoji = resolve('emoji/svg');
const noto = resolve('emoji/noto-svg');
const config = loadConfig({ LOG_LEVEL: 'silent' });
const uri = async (path: string) => 'data:image/svg+xml;base64,' + (await fs.readFile(path)).toString('base64');
function images(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(images);
  if (!isValidElement<{ children?: ReactNode; src?: string }>(node)) return [];
  return node.type === 'img' ? [node.props.src!] : images(node.props.children);
}
function withoutTwemoji() {
  vi.mocked(readdir).mockImplementation((async (path: string) =>
    path === twemoji ? [] : fs.readdir(path)) as typeof readdir);
}
beforeEach(() => {
  vi.resetModules();
  vi.mocked(readFile).mockReset().mockImplementation(fs.readFile);
  vi.mocked(readdir).mockReset().mockImplementation(fs.readdir);
});

describe('Noto SVG fallback', () => {
  it('keeps Twemoji first without reading the fallback directory', async () => {
    const { additionalAsset } = await import('../src/core/emoji.js');
    expect(await additionalAsset('emoji', '😀')).toBe(await uri(join(twemoji, '1f600.svg')));
    expect(readdir).not.toHaveBeenCalledWith(noto);
  });

  it.each([
    ['😀', 'emoji_u1f600.svg'],
    ['©️', 'emoji_u00a9.svg'],
    ['1️⃣', 'emoji_u0031_20e3.svg'],
    ['👩🏽‍💻', 'emoji_u1f469_1f3fd_200d_1f4bb.svg'],
    ['🏳️‍🌈', 'emoji_u1f3f3_200d_1f308.svg'],
  ])('resolves the complete Noto sequence %s and caches it without warnings', async (text, filename) => {
    withoutTwemoji();
    const { additionalAsset, prepareEmoji } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    const expected = await uri(join(noto, filename));
    expect(images(await prepareEmoji(text, warn))).toEqual([expected]);
    const reads = vi.mocked(readFile).mock.calls.length;
    expect(await additionalAsset('emoji', text, warn)).toBe(expected);
    expect(readFile).toHaveBeenCalledTimes(reads);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back when an indexed Twemoji file disappears', async () => {
    vi.mocked(readFile).mockImplementation((async (path: string) => {
      if (path === join(twemoji, '1f600.svg')) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      return fs.readFile(path);
    }) as typeof readFile);
    const { additionalAsset } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    expect(await additionalAsset('emoji', '😀', warn)).toBe(await uri(join(noto, 'emoji_u1f600.svg')));
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on every request when neither source has the complete sequence', async () => {
    withoutTwemoji();
    const { additionalAsset } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    const first = await additionalAsset('emoji', '😀‍🚀', warn);
    expect(await additionalAsset('emoji', '😀‍🚀', warn)).toBe(first);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(typeof first).toBe('string');
    expect(Buffer.from((first as string).split(',')[1]!, 'base64').toString()).toContain('<rect');
  });

  it.each(['ENOENT', 'EACCES'])('does not hide a fallback directory failure: %s', async code => {
    vi.mocked(readdir).mockImplementation((async (path: string) => {
      if (path === twemoji) return [];
      throw Object.assign(new Error('directory unavailable'), { code });
    }) as typeof readdir);
    const { additionalAsset } = await import('../src/core/emoji.js');
    await expect(additionalAsset('emoji', '😀')).rejects.toMatchObject({ code });
  });

  it('does not treat a permission failure as a missing glyph', async () => {
    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
    const { additionalAsset } = await import('../src/core/emoji.js');
    await expect(additionalAsset('emoji', '😀')).rejects.toMatchObject({ code: 'EACCES' });
    expect(readdir).not.toHaveBeenCalledWith(noto);
  });

  it('accepts every normalized Noto SVG in the PNG adapter', async () => {
    const files = await fs.readdir(noto);
    expect(files).toHaveLength(3731);
    for (const file of files) {
      const source = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><image width="128" height="128" href="${await uri(join(noto, file))}"/></svg>`;
      expect(() => svgForSkia(source, config), file).not.toThrow();
    }
  });

  it('renders Noto gradients and clipping through real SVG and PNG layout', async () => {
    withoutTwemoji();
    const { Renderer } = await import('../src/core/renderer.js');
    const renderer = new Renderer(config, await loadFonts(config.fontConfig));
    const request = {
      template: 'social_post',
      data: {
        author: { name: '作者 👩🏽‍💻' },
        content: '中文 日本語 English 😀 ©️ 1️⃣ 🏳️‍🌈 🌪️ 🌷 🎃\n' + '换行 👩🏽‍💻 '.repeat(30),
      },
      watermark: 'Noto 😀',
    };
    const svg = await renderer.render({ ...request, format: 'svg' });
    const png = await renderer.render({ ...request, format: 'png' });
    expect(svg.warnings).toEqual([]);
    expect(png.warnings).toEqual([]);
    expect([png.width, png.height]).toEqual([svg.width * 2, svg.height * 2]);
    const metadata = await sharp(png.body).metadata();
    expect([metadata.width, metadata.height]).toEqual([png.width, png.height]);
    expect(Buffer.from(svg.body).toString()).toContain(await uri(join(noto, 'emoji_u1f600.svg')));
  });
});
