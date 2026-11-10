import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ImageSource, Node } from '@takumi-rs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, readFile: vi.fn(fs.readFile), readdir: vi.fn(fs.readdir) };
});
const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const twemoji = resolve('emoji/svg');
function images(node: Node): string[] {
  return node.type === 'image'
    ? [String(node.src)]
    : node.type === 'container'
      ? (node.children ?? []).flatMap(images)
      : [];
}
beforeEach(() => {
  vi.resetModules();
  vi.mocked(readFile).mockReset().mockImplementation(fs.readFile);
  vi.mocked(readdir).mockReset().mockImplementation(fs.readdir);
});

describe('Twemoji resources and fallback policy', () => {
  it.each([
    ['😀', '1f600.svg'],
    ['©️', 'a9.svg'],
    ['1️⃣', '31-20e3.svg'],
    ['👩🏽‍💻', '1f469-1f3fd-200d-1f4bb.svg'],
    ['🏳️‍🌈', '1f3f3-fe0f-200d-1f308.svg'],
  ])('resolves the complete Twemoji sequence %s and caches it without warnings', async (text, filename) => {
    const { emojiImage, prepareEmoji } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    const expected = {
      src:
        'forma:emoji:' +
        filename
          .replace(/\.svg$/, '')
          .split('-')
          .filter(c => c !== 'fe0f')
          .join('-'),
      data: await fs.readFile(join(twemoji, filename)),
    };
    expect(images(await prepareEmoji({ type: 'text', text }, warn, new Map<string, ImageSource>()))).toEqual([
      expected.src,
    ]);
    const reads = vi.mocked(readFile).mock.calls.length;
    expect(await emojiImage(text, warn)).toEqual(expected);
    expect(readFile).toHaveBeenCalledTimes(reads);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back when an indexed Twemoji file disappears', async () => {
    vi.mocked(readFile).mockImplementation((async (path: string) => {
      if (path === join(twemoji, '1f600.svg')) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      return fs.readFile(path);
    }) as typeof readFile);
    const { emojiImage } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    const result = await emojiImage('😀', warn);
    expect(Buffer.from(result.data as Uint8Array).toString()).toContain('<rect');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns on every request when Twemoji lacks the complete sequence', async () => {
    const { emojiImage } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    const first = await emojiImage('😀‍🚀', warn);
    expect(await emojiImage('😀‍🚀', warn)).toBe(first);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(first.src).toBe('forma:emoji:missing');
    expect(Buffer.from(first.data as Uint8Array).toString()).toContain('<rect');
  });

  it.each(['ENOENT', 'EACCES'])('does not hide an asset directory failure: %s', async code => {
    vi.mocked(readdir).mockImplementation((async () => {
      throw Object.assign(new Error('directory unavailable'), { code });
    }) as typeof readdir);
    const { emojiImage } = await import('../src/core/emoji.js');
    await expect(emojiImage('😀', () => {})).rejects.toMatchObject({ code });
  });

  it('does not treat a permission failure as a missing glyph', async () => {
    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
    const { emojiImage } = await import('../src/core/emoji.js');
    await expect(emojiImage('😀', () => {})).rejects.toMatchObject({ code: 'EACCES' });
  });
});
