import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
});
