import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFonts } from '../src/core/fonts.js';

describe('font configuration', () => {
  it.each(['body', 'monospace'])('rejects a config without a %s family before reading font files', async missing => {
    const directory = await mkdtemp(join(tmpdir(), 'forma-font-config-'));
    try {
      const path = join(directory, 'fonts.json');
      await writeFile(
        path,
        JSON.stringify([
          { name: 'Other', path: 'missing.ttf', weight: 400, usage: missing === 'body' ? 'monospace' : 'body' },
          { name: 'Symbols', path: 'missing.ttf', weight: 400, usage: 'fallback' },
        ]),
      );
      await expect(loadFonts(path)).rejects.toThrow('Font config must include a ' + missing + ' font');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
