import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import source from '../emoji/source.json' with { type: 'json' };

const directory = fileURLToPath(new URL('../emoji/', import.meta.url));
const checksum = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

export async function verifyEmoji(root = directory) {
  const files = (await readdir(join(root, 'svg'))).sort();
  if (files.length !== source.count) throw new Error('Emoji asset count mismatch');
  const hash = createHash('sha256');
  for (const file of files)
    hash
      .update(file + '\0')
      .update(await readFile(join(root, 'svg', file)))
      .update('\0');
  if (hash.digest('hex') !== source.svgSha256) throw new Error('Emoji asset checksum mismatch');
}

export async function fetchEmoji(
  root = directory,
  download = async () => {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error('Emoji download failed: HTTP ' + response.status);
    return new Uint8Array(await response.arrayBuffer());
  },
) {
  try {
    await verifyEmoji(root);
  } catch {
    console.log('Downloading Twemoji ' + source.version);
    const data = await download();
    if (checksum(data) !== source.sha256) throw new Error('Emoji archive checksum mismatch');
    const archive = unzipSync(data, {
      filter: entry =>
        entry.name.startsWith(source.prefix) && /^[a-f0-9-]+\.svg$/.test(entry.name.slice(source.prefix.length)),
    });
    await mkdir(root, { recursive: true });
    const temporary = await mkdtemp(join(root, '.download-'));
    try {
      await mkdir(join(temporary, 'svg'));
      for (const [name, bytes] of Object.entries(archive))
        await writeFile(join(temporary, 'svg', name.slice(source.prefix.length)), bytes);
      await verifyEmoji(temporary);
      await rm(join(root, 'svg'), { recursive: true, force: true });
      await rename(join(temporary, 'svg'), join(root, 'svg'));
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  console.log('Twemoji ' + source.version + ': OK (' + source.count + ' SVGs)');
}
