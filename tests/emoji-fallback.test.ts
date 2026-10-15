import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, readFile: vi.fn(fs.readFile), readdir: vi.fn(fs.readdir) };
});
const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const twemoji = resolve('emoji/svg');
const uri = async (path: string) => 'data:image/svg+xml;base64,' + (await fs.readFile(path)).toString('base64');
function images(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(images);
  if (!isValidElement<{ children?: ReactNode; src?: string }>(node)) return [];
  return node.type === 'img' ? [node.props.src!] : images(node.props.children);
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
    const { additionalAsset, prepareEmoji } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    const expected = await uri(join(twemoji, filename));
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
    const result = await additionalAsset('emoji', '😀', warn);
    expect(Buffer.from((result as string).split(',')[1]!, 'base64').toString()).toContain('<rect');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns on every request when Twemoji lacks the complete sequence', async () => {
    const { additionalAsset } = await import('../src/core/emoji.js');
    const warn = vi.fn();
    const first = await additionalAsset('emoji', '😀‍🚀', warn);
    expect(await additionalAsset('emoji', '😀‍🚀', warn)).toBe(first);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(typeof first).toBe('string');
    expect(Buffer.from((first as string).split(',')[1]!, 'base64').toString()).toContain('<rect');
  });

  it.each(['ENOENT', 'EACCES'])('does not hide an asset directory failure: %s', async code => {
    vi.mocked(readdir).mockImplementation((async () => {
      throw Object.assign(new Error('directory unavailable'), { code });
    }) as typeof readdir);
    const { additionalAsset } = await import('../src/core/emoji.js');
    await expect(additionalAsset('emoji', '😀')).rejects.toMatchObject({ code });
  });

  it('does not treat a permission failure as a missing glyph', async () => {
    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }));
    const { additionalAsset } = await import('../src/core/emoji.js');
    await expect(additionalAsset('emoji', '😀')).rejects.toMatchObject({ code: 'EACCES' });
  });
});
