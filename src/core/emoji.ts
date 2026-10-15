import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cloneElement, createElement, isValidElement, type ReactNode } from 'react';
import presentation from '../../emoji/presentation.json' with { type: 'json' };
import { FormaError } from './errors.js';

const emojiDirectory = resolve('emoji/svg');
const cache = new Map<string, string>();
let filenames: Promise<Map<string, string>> | undefined;
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
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="6" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2"/><path d="M13 13a5 5 0 0 1 10 0c0 4-5 4-5 8" fill="none" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="27" r="1.7" fill="#6b7280"/></svg>',
  ).toString('base64');

async function emojiImage(segment: string, onMissing: () => void): Promise<string> {
  const key = canonical(segment);
  const existing = cache.get(key);
  if (existing) return existing;
  filenames ??= readdir(emojiDirectory).then(
    files => new Map(files.map(file => [file.replace(/-fe0f/g, '').replace(/\.svg$/, ''), file])),
  );
  const filename = (await filenames).get(key);
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
  onMissing();
  return placeholder;
}

export async function additionalAsset(language: string, segment: string, onMissing = () => {}): Promise<string> {
  if (language === 'emoji' && [...segment.matchAll(candidates)].some(match => match[0] === segment))
    return emojiImage(segment, onMissing);
  throw new FormaError('MISSING_GLYPH', 'Configured fonts or bundled emoji do not cover this text', 422, { segment });
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
