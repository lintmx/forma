import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cloneElement, createElement, isValidElement, type ReactNode } from 'react';
import type { Font } from 'satori';
import presentation from '../../emoji/presentation.json' with { type: 'json' };

const emojiDirectories = [resolve('emoji/svg'), resolve('emoji/noto-svg')];
const cache = new Map<string, string>();
const filenames = new Map<string, Promise<Map<string, string>>>();
const textDefault = new Set(presentation.textDefault);
const textVariants = new Set(presentation.textVariants);
// Match whole candidates, including unknown ZWJ combinations and reserved emoji
// code points. Do not rely on the host/Satori Unicode segmentation version.
const atom = String.raw`(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})[\uFE0E\uFE0F]*\p{Emoji_Modifier}?`;
const candidates = new RegExp(
  String.raw`[0-9#*][\uFE0E\uFE0F]*\u20E3|\p{Regional_Indicator}{1,2}[\uFE0E\uFE0F]*|${atom}(?:[\u{E0020}-\u{E007F}]+|(?:\u200D${atom})*)`,
  'gu',
);
const code = (text: string) =>
  Array.from(text)
    .map(char => char.codePointAt(0)!.toString(16))
    .join('-');
const canonical = (text: string) => code(text.replace(/[\uFE0E\uFE0F]/g, ''));
const placeholder =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect x="6" y="6" width="24" height="24" fill="none" stroke="#6b7280" stroke-width="2"/></svg>',
  ).toString('base64');

async function emojiImage(segment: string, onMissing: () => void): Promise<string> {
  const key = canonical(segment);
  const existing = cache.get(key);
  if (existing) return existing;
  for (const emojiDirectory of emojiDirectories) {
    let index = filenames.get(emojiDirectory);
    if (!index) {
      index = readdir(emojiDirectory).then(
        files =>
          new Map(
            files
              .filter(file => file.endsWith('.svg'))
              .map(file => [
                file
                  .replace(/^emoji_u/, '')
                  .replace(/\.svg$/, '')
                  .split(/[-_]/)
                  .map(part => Number.parseInt(part, 16))
                  .filter(point => point !== 0xfe0e && point !== 0xfe0f)
                  .map(point => point.toString(16))
                  .join('-'),
                file,
              ]),
          ),
      );
      filenames.set(emojiDirectory, index);
    }
    const filename = (await index).get(key);
    if (filename) {
      try {
        const uri = 'data:image/svg+xml;base64,' + (await readFile(join(emojiDirectory, filename))).toString('base64');
        if (cache.size >= 512) cache.delete(cache.keys().next().value!);
        cache.set(key, uri);
        return uri;
      } catch (error) {
        // A missing individual asset may degrade; permissions/I/O failures are not missing glyphs.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
  onMissing();
  return placeholder;
}

export async function additionalAsset(
  language: string,
  segment: string,
  onMissingEmoji = () => {},
  onMissingGlyph = () => {},
): Promise<string | Font[]> {
  if (language === 'emoji' && [...segment.matchAll(candidates)].some(match => match[0] === segment))
    return emojiImage(segment, onMissingEmoji);
  onMissingGlyph();
  // Let Satori use the configured font's .notdef glyph for each missing character.
  // Non-emoji segments can contain multiple graphemes, so a single image is unsuitable.
  return [];
}

// Resolve the same pure function components Satori supports, then replace text
// only (never URLs, attributes or SVG paths). Used for measurement AND final layout.
export async function prepareEmoji(node: ReactNode, onMissing: () => void): Promise<ReactNode> {
  if (typeof node === 'string') {
    const pieces: ReactNode[] = [];
    let end = 0;
    for (const match of node.matchAll(candidates)) {
      const segment = match[0];
      const base = segment.replace(/[\uFE0E\uFE0F]/g, '');
      const single = Array.from(base).length === 1;
      const point = base.codePointAt(0)!;
      // Respect standardized text presentation when a text glyph is available.
      // Nonstandard VS15 (e.g. 💕︎) is default-ignorable and uses the base emoji.
      const asText =
        single &&
        ((segment.includes('\uFE0E') && textVariants.has(point)) ||
          (!segment.includes('\uFE0F') && textDefault.has(point)));
      pieces.push(node.slice(end, match.index));
      pieces.push(
        asText
          ? segment
          : createElement('img', {
              key: match.index,
              src: await emojiImage(segment, onMissing),
              alt: segment,
              style: { width: '1em', height: '1em', verticalAlign: '-0.125em', flexShrink: 0 },
            }),
      );
      end = match.index + segment.length;
    }
    if (!end) return node;
    pieces.push(node.slice(end));
    return createElement('span', null, ...pieces);
  }
  if (Array.isArray(node)) return Promise.all(node.map(child => prepareEmoji(child, onMissing)));
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (typeof node.type === 'function') {
    const component = node.type as (props: { children?: ReactNode }) => ReactNode | Promise<ReactNode>;
    return prepareEmoji(await component(node.props), onMissing);
  }
  if (node.props.children === undefined) return node;
  return cloneElement(node, { children: await prepareEmoji(node.props.children, onMissing) });
}
