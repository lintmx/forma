import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchEmoji, verifyEmoji } from '../scripts/emoji-assets.js';

describe('pinned emoji resources', () => {
  it('verifies the entire local SVG set and reuses it without a download', async () => {
    const download = vi.fn(async () => new Uint8Array());
    await verifyEmoji();
    await fetchEmoji(undefined, download);
    expect(download).not.toHaveBeenCalled();
  });
  it('rejects an invalid download before installing any resources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forma-emoji-'));
    try {
      await expect(fetchEmoji(directory, async () => new Uint8Array([1, 2, 3]))).rejects.toThrow(
        'archive checksum mismatch',
      );
      await expect(verifyEmoji(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('verifies the Noto archive independently after reusing Twemoji', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forma-emoji-'));
    try {
      await symlink(resolve('emoji/svg'), join(directory, 'svg'));
      const download = vi.fn(async () => new Uint8Array([1, 2, 3]));
      await expect(fetchEmoji(directory, download)).rejects.toThrow('archive checksum mismatch');
      expect(download).toHaveBeenCalledExactlyOnceWith(
        'https://codeload.github.com/googlefonts/noto-emoji/zip/refs/tags/v2.051',
      );
      await expect(verifyEmoji(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
