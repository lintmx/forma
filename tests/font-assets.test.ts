import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../fonts/fonts.json';
import sources from '../fonts/sources.json';
import { fetchFonts, verifyFonts } from '../scripts/font-assets.js';

const checksum = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const bytes = Buffer.from('font fixture');
const raw = {
  url: 'https://example.com/font.ttf',
  sha256: checksum(bytes),
  files: [{ path: 'font.ttf', sha256: checksum(bytes) }],
};
const directories: string[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'forma-font-assets-'));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('font asset preparation', () => {
  it('covers every configured font exactly once', () => {
    expect(sources.flatMap(source => source.files.map(file => file.path)).sort()).toEqual(
      config.map(font => font.path).sort(),
    );
  });

  it('downloads missing files, reuses valid files offline, and repairs corrupt files', async () => {
    const path = await directory();
    const download = vi.fn(async () => bytes);
    await fetchFonts(path, [raw], download);
    expect(await readFile(join(path, 'font.ttf'))).toEqual(bytes);
    await fetchFonts(path, [raw], download);
    expect(download).toHaveBeenCalledTimes(1);
    await writeFile(join(path, 'font.ttf'), 'corrupt');
    await expect(verifyFonts(path, [raw])).rejects.toThrow('checksum mismatch');
    await fetchFonts(path, [raw], download);
    expect(download).toHaveBeenCalledTimes(2);
    await verifyFonts(path, [raw]);
  });

  it('rejects an invalid download without replacing existing data', async () => {
    const path = await directory();
    await writeFile(join(path, 'font.ttf'), 'old');
    await expect(fetchFonts(path, [raw], async () => Buffer.from('wrong'))).rejects.toThrow('checksum mismatch');
    expect(await readFile(join(path, 'font.ttf'), 'utf8')).toBe('old');
    expect(await readdir(path)).toEqual(['font.ttf']);
  });

  it('extracts only specified ZIP entries and verifies their own checksums', async () => {
    const path = await directory();
    const archive = zipSync({ 'nested/font.ttf': bytes, 'unused.ttf': Buffer.from('unused') });
    const source = {
      url: 'https://example.com/fonts.zip',
      sha256: checksum(archive),
      files: [{ ...raw.files[0]!, archivePath: 'nested/font.ttf' }],
    };
    await fetchFonts(path, [source], async () => archive);
    expect(await readdir(path)).toEqual(['font.ttf']);
    expect(await readFile(join(path, 'font.ttf'))).toEqual(bytes);
    await rm(join(path, 'font.ttf'));
    const invalid = { ...source, files: [{ ...source.files[0]!, sha256: '0'.repeat(64) }] };
    await expect(fetchFonts(path, [invalid], async () => archive)).rejects.toThrow('checksum mismatch');
    expect(await readdir(path)).toEqual([]);
    const missing = { ...source, files: [{ ...source.files[0]!, archivePath: 'absent.ttf' }] };
    await expect(fetchFonts(path, [missing], async () => archive)).rejects.toThrow('missing from archive');
    expect(await readdir(path)).toEqual([]);
  });

  it('propagates network failures without creating a font', async () => {
    const path = await directory();
    await expect(
      fetchFonts(path, [raw], async () => {
        throw new Error('network unavailable');
      }),
    ).rejects.toThrow('network unavailable');
    expect(await readdir(path)).toEqual([]);
  });
});
