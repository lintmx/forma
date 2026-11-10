import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ImageSource, Node } from '@takumi-rs/core';
import presentation from '../../emoji/presentation.json' with { type: 'json' };

const emojiDirectory = resolve('emoji/svg');
const cache = new Map<string, ImageSource>();
let filenames: Promise<Map<string, string>> | undefined;
const textDefault = new Set(presentation.textDefault);
const textVariants = new Set(presentation.textVariants);
// Match whole candidates, including unknown ZWJ combinations and reserved emoji
// code points. Do not rely on the host Unicode segmentation version.
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
const placeholder: ImageSource = {
  src: 'forma:emoji:missing',
  data: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect x="6" y="6" width="24" height="24" fill="none" stroke="#6b7280" stroke-width="2"/></svg>',
  ),
};

export async function emojiImage(segment: string, onMissing: () => void): Promise<ImageSource> {
  const key = canonical(segment);
  const existing = cache.get(key);
  if (existing) return existing;
  if (!filenames) {
    filenames = readdir(emojiDirectory).then(
      files =>
        new Map(
          files
            .filter(file => file.endsWith('.svg'))
            .map(file => [
              file
                .replace(/\.svg$/, '')
                .split('-')
                .map(part => Number.parseInt(part, 16))
                .filter(point => point !== 0xfe0e && point !== 0xfe0f)
                .map(point => point.toString(16))
                .join('-'),
              file,
            ]),
        ),
    );
  }
  const filename = (await filenames).get(key);
  if (filename) {
    try {
      const uri = { src: 'forma:emoji:' + key, data: await readFile(join(emojiDirectory, filename)) };
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

export async function prepareEmoji(node: Node, onMissing: () => void, images: Map<string, ImageSource>): Promise<Node> {
  if (node.type === 'container') {
    return {
      ...node,
      children: await Promise.all(
        (node.children ?? [])
          .filter(child => !(child.type === 'text' && child.text === '' && !child.tagName && !child.style))
          .map(child => prepareEmoji(child, onMissing, images)),
      ),
    };
  }
  if (node.type !== 'text') return node;
  const pieces: Node[] = [];
  let end = 0;
  for (const match of node.text.matchAll(candidates)) {
    const segment = match[0];
    const base = segment.replace(/[\uFE0E\uFE0F]/g, '');
    const single = Array.from(base).length === 1;
    const point = base.codePointAt(0)!;
    const asText =
      single &&
      ((segment.includes('\uFE0E') && textVariants.has(point)) ||
        (!segment.includes('\uFE0F') && textDefault.has(point)));
    if (asText) continue;
    if (match.index > end) pieces.push({ type: 'text', text: node.text.slice(end, match.index) });
    const source = await emojiImage(segment, onMissing);
    images.set(source.src, source);
    pieces.push({
      type: 'image',
      src: source.src,
      style: { display: 'inline-block', width: '1em', height: '1em', verticalAlign: '-0.125em', flexShrink: 0 },
    });
    end = match.index + segment.length;
  }
  if (!end) return node;
  if (end < node.text.length) pieces.push({ type: 'text', text: node.text.slice(end) });
  const { text: _text, ...rest } = node;
  return { ...rest, type: 'container', children: pieces };
}
