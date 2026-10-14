import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { FormaError } from './errors.js';

const require = createRequire(import.meta.url);
const emojiDirectory = dirname(require.resolve('@twemoji/svg/package.json'));
const cache = new Map<string, string>();

export async function additionalAsset(language: string, segment: string): Promise<string> {
  if (language === 'emoji') {
    const code = Array.from(segment)
      .map(char => char.codePointAt(0)!.toString(16))
      .filter(part => part !== 'fe0f')
      .join('-');
    const existing = cache.get(code);
    if (existing) return existing;
    try {
      // Some ZWJ sequences retain the variation selector in their filenames.
      const originalCode = Array.from(segment)
        .map(char => char.codePointAt(0)!.toString(16))
        .join('-');
      const svg = await readFile(join(emojiDirectory, code + '.svg')).catch(() =>
        readFile(join(emojiDirectory, originalCode + '.svg')),
      );
      const uri = 'data:image/svg+xml;base64,' + svg.toString('base64');
      if (cache.size >= 512) cache.delete(cache.keys().next().value!);
      cache.set(code, uri);
      return uri;
    } catch {
      /* The caller gets a useful error instead of an empty glyph. */
    }
  }
  throw new FormaError('MISSING_GLYPH', 'Configured fonts or bundled emoji do not cover this text', 422, { segment });
}
