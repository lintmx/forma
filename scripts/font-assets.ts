import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import manifest from '../fonts/sources.json' with { type: 'json' };

interface FontSource {
  url: string;
  sha256: string;
  files: { path: string; sha256: string; archivePath?: string }[];
}

const fontDirectory = fileURLToPath(new URL('../fonts/', import.meta.url));
const sources: FontSource[] = manifest;
const checksum = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

function verify(data: Uint8Array, expected: string, name: string) {
  if (checksum(data) !== expected) throw new Error('Font checksum mismatch: ' + name);
}

async function downloadSource(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error('Font download failed: HTTP ' + response.status + ' ' + url);
  return new Uint8Array(await response.arrayBuffer());
}

export async function verifyFonts(directory = fontDirectory, entries = sources) {
  for (const source of entries) {
    for (const file of source.files) {
      verify(await readFile(join(directory, file.path)), file.sha256, file.path);
      console.log(file.path + ': OK');
    }
  }
}

export async function fetchFonts(directory = fontDirectory, entries = sources, download = downloadSource) {
  await mkdir(directory, { recursive: true });
  for (const source of entries) {
    const missing: FontSource['files'] = [];
    for (const file of source.files) {
      const data = await readFile(join(directory, file.path)).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      });
      if (!data || checksum(data) !== file.sha256) missing.push(file);
    }
    if (!missing.length) continue;

    console.log('Downloading fonts: ' + source.url);
    const data = await download(source.url);
    verify(data, source.sha256, source.url);
    const archive = missing.some(file => file.archivePath)
      ? unzipSync(data, { filter: entry => missing.some(file => file.archivePath === entry.name) })
      : undefined;
    const temporary = await mkdtemp(join(directory, '.download-'));
    try {
      // Verify every selected file before replacing any local font.
      for (const file of missing) {
        const bytes = file.archivePath ? archive?.[file.archivePath] : data;
        if (!bytes) throw new Error('Font missing from archive: ' + file.archivePath);
        verify(bytes, file.sha256, file.path);
        await writeFile(join(temporary, file.path), bytes);
      }
      for (const file of missing) await rename(join(temporary, file.path), join(directory, file.path));
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  await verifyFonts(directory, entries);
}
