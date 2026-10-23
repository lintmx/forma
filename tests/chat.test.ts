import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { Renderer } from '../src/core/renderer.js';
import { chat } from '../src/templates/chat/index.js';
import { type ChatData, chatSchema } from '../src/templates/chat/schema.js';
import { createTemplateRegistry } from '../src/templates/index.js';

let renderer: Renderer;
const imageUrl = pathToFileURL(resolve('artifacts/chat/image.png')).href;
const missingUrl = pathToFileURL(resolve('artifacts/chat/unavailable/source.png')).href;

beforeAll(async () => {
  const config = loadConfig({ LOG_LEVEL: 'silent' });
  renderer = new Renderer(config, await loadFonts(config.fontConfig), createTemplateRegistry());
  await mkdir('artifacts/chat', { recursive: true });
  const image = new PNG({ width: 320, height: 180 });
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      image.data.set([70 + Math.floor(x / 3), 120 + Math.floor(y / 2), 190, 255], (y * image.width + x) * 4);
    }
  }
  await writeFile('artifacts/chat/image.png', PNG.sync.write(image));
});

it('validates the example, message variants and resource URLs', () => {
  expect(chatSchema.safeParse(chat.mock).success).toBe(true);
  for (const message of [
    { type: 'text', text: '' },
    { type: 'text', text: '你好', side: 'other' },
    { type: 'image' },
    { type: 'image', url: 'javascript:alert(1)' },
    { type: 'system', text: '提示', side: 'right' },
    { type: 'text', text: '你好', translation: { text: 'Hello' } },
    { type: 'image', url: 'asset:photo', sentAt: 123 },
    { type: 'system', text: '提示', translation: '文'.repeat(4001) },
  ]) {
    expect(chatSchema.safeParse({ title: '聊天', messages: [message] }).success).toBe(false);
  }
  expect(chatSchema.safeParse({ title: '聊天', messages: [{ type: 'image', url: 'asset:photo' }] }).success).toBe(true);
});

it('displays translations and sent times for text, image and system messages', () => {
  const data = chatSchema.parse({
    title: '逐条翻译',
    messages: [
      { type: 'text', text: 'Hello', translation: '你好', sentAt: '18:30', time: '星期五' },
      { type: 'text', side: 'right', text: '收到', translation: 'Received', sentAt: '18:31' },
      { type: 'image', url: 'asset:photo', translation: '海边照片', sentAt: '18:32' },
      { type: 'system', text: '群名已更新', translation: 'Group renamed', sentAt: '18:33' },
    ],
  });
  const html = renderToStaticMarkup(
    chat.render(data, { assets: {}, fontFamily: 'sans-serif', monospaceFontFamily: 'monospace' }),
  );
  for (const message of data.messages) {
    expect(html).toContain(message.translation);
    expect(html).toContain(message.sentAt);
  }
  expect(html).toContain('星期五');
});

it('wraps multilingual translations and sent times while preserving legacy messages without these fields', async () => {
  const messages: ChatData['messages'] = [
    { type: 'text', name: '小夏', text: 'Hello', time: '星期五' },
    { type: 'text', side: 'right', text: '收到' },
    { type: 'image', side: 'right', url: imageUrl },
    { type: 'system', text: '群名已更新' },
  ];
  const data = { title: '逐条译文与时间', messages };
  const legacy = await renderer.render({ template: 'chat', data, format: 'svg' });
  const blank = await renderer.render({
    template: 'chat',
    data: { ...data, messages: messages.map(message => ({ ...message, translation: '  \n', sentAt: '  ' })) },
    format: 'svg',
  });
  expect(blank.body).toEqual(legacy.body);
  const heights = [];
  for (const count of [1, 6]) {
    const translated = {
      ...data,
      messages: messages.map((message, index) => ({
        ...message,
        translation: (
          '中文 日本語 한국어 English 👩🏽‍💻\n' +
          'https://example.com/' +
          'long-path-'.repeat(count)
        ).repeat(count),
        sentAt: `2026-10-23 18:3${index}:00 +08:00${count > 1 ? '（星期五 / Friday / 金曜日）' : ''}`,
      })),
    };
    const svg = await renderer.render({ template: 'chat', data: translated, format: 'svg' });
    const png = await renderer.render({ template: 'chat', data: translated, format: 'png' });
    expect(svg.width).toBeGreaterThanOrEqual(440);
    expect(svg.width).toBeLessThanOrEqual(600);
    expect(png.width).toBe(svg.width * 2);
    expect(png.height).toBe(svg.height * 2);
    expect(svg.warnings).toEqual([]);
    expect(png.warnings).toEqual([]);
    heights.push(svg.height);
    await writeFile(`artifacts/chat/translation-${count}.png`, png.body);
    await writeFile(`artifacts/chat/translation-${count}.svg`, svg.body);
  }
  expect(heights[0]).toBeGreaterThan(legacy.height);
  expect(heights[1]).toBeGreaterThan(heights[0]! + 300);
});

it('renders the conversation as real SVG and 2x PNG with incoming and outgoing bubbles', async () => {
  const png = await renderer.render({ template: 'chat', data: chat.mock, format: 'png' });
  const svg = await renderer.render({ template: 'chat', data: chat.mock, format: 'svg' });
  expect(svg.width).toBeGreaterThan(440);
  expect(svg.width).toBeLessThan(600);
  expect(png.width).toBe(svg.width * 2);
  expect(png.height).toBe(svg.height * 2);
  expect(png.warnings).toEqual([]);
  expect(svg.warnings).toEqual([]);
  const pixels = PNG.sync.read(Buffer.from(png.body));
  const bubblePixels = [0, 0];
  for (let y = 180; y < pixels.height - 160; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const offset = (y * pixels.width + x) * 4;
      const [r, g, b] = pixels.data.subarray(offset, offset + 3);
      if (r! < 30 && g! > 70 && g! < 140 && b! > 170 && b! < 245 && x > pixels.width / 2) bubblePixels[1]!++;
      if (r === 255 && g === 255 && b === 255 && x > 180 && x < pixels.width / 2) bubblePixels[0]!++;
    }
  }
  expect(bubblePixels[0]).toBeGreaterThan(5000);
  expect(bubblePixels[1]).toBeGreaterThan(5000);
  await writeFile('artifacts/chat/example.png', png.body);
  await writeFile('artifacts/chat/example.svg', svg.body);
});

it.each(['left', 'right'] as const)(
  'adapts one-sided %s messages between 440 and 600px with content height',
  async side => {
    const sizes = [];
    for (const [name, text] of [
      ['short', '你好 👋'],
      ['medium', '明天下午三点在海边见，记得带上相机。'],
      ['long', '中文 日本語 한국어 English 👩🏽‍💻 https://example.com/'.repeat(8)],
    ] as const) {
      const data = { title: '聊天', messages: [{ type: 'text', side, text, sentAt: '18:30' }] };
      const svg = await renderer.render({ template: 'chat', data, format: 'svg' });
      const png = await renderer.render({ template: 'chat', data, format: 'png' });
      expect(png.width).toBe(svg.width * 2);
      expect(png.height).toBe(svg.height * 2);
      expect(svg.warnings).toEqual([]);
      expect(png.warnings).toEqual([]);
      sizes.push(svg);
      await writeFile(`artifacts/chat/adaptive-${side}-${name}.png`, png.body);
      await writeFile(`artifacts/chat/adaptive-${side}-${name}.svg`, svg.body);
    }
    expect(sizes[0]!.width).toBe(440);
    expect(sizes[1]!.width).toBeGreaterThan(440);
    expect(sizes[1]!.width).toBeLessThan(600);
    expect(sizes[2]!.width).toBe(600);
    expect(sizes[2]!.height).toBeGreaterThan(sizes[0]!.height);
    const two = await renderer.render({
      template: 'chat',
      data: { title: '聊天', messages: Array(2).fill({ type: 'text', side, text: '你好 👋', sentAt: '18:30' }) },
      format: 'svg',
    });
    expect(two.width).toBe(440);
    expect(two.height).toBeGreaterThan(sizes[0]!.height);
  },
);

it('grows with long multilingual messages and preserves explicit newlines', async () => {
  const heights = [];
  for (const count of [1, 8]) {
    const data: ChatData = {
      title: '很长的群聊名称 Chat room 日本語 ✨ '.repeat(3),
      subtitle: '状态说明 '.repeat(20),
      messages: [
        {
          type: 'text',
          name: '很长的昵称 LongNickname '.repeat(3),
          text: '中文 日本語 한국어 English 👩🏽‍💻\n'.repeat(count),
        },
        { type: 'text', side: 'right', text: 'https://example.com/' + 'long-path-'.repeat(count * 4) },
      ],
    };
    const png = await renderer.render({ template: 'chat', data, format: 'png' });
    const svg = await renderer.render({ template: 'chat', data, format: 'svg' });
    expect(png.width).toBe(1200);
    expect(png.height).toBe(svg.height * 2);
    expect(png.warnings).toEqual([]);
    heights.push(png.height);
    if (count === 8) {
      await writeFile('artifacts/chat/long.png', png.body);
      await writeFile('artifacts/chat/long.svg', svg.body);
    }
  }
  expect(heights[1]).toBeGreaterThan(heights[0]! + 400);
});

it('loads real avatars and pictures, and renders missing resources with warnings', async () => {
  for (const [name, url] of [
    ['images', imageUrl],
    ['missing', missingUrl],
  ] as const) {
    const data: ChatData = {
      title: '图片消息',
      messages: [
        { type: 'image', name: '小夏', avatarUrl: url, url, alt: '今天拍的海边照片', time: '今天 18:30' },
        { type: 'image', name: '我', side: 'right', avatarUrl: url, url },
        { type: 'text', side: 'right', text: '收到啦 📷' },
      ],
    };
    for (const format of ['png', 'svg'] as const) {
      const result = await renderer.render({ template: 'chat', data, format });
      expect(result.warnings).toEqual(name === 'missing' ? ['IMAGE_UNAVAILABLE'] : []);
      if (format === 'svg' && name === 'images') {
        expect(Buffer.from(result.body).toString()).toContain('data:image/png;base64,');
      }
      if (format === 'png' && name === 'images') {
        const pixels = PNG.sync.read(Buffer.from(result.body));
        let imagePixels = 0;
        for (let i = 0; i < pixels.data.length; i += 4) {
          if (
            Math.abs(pixels.data[i + 2]! - 190) < 35 &&
            pixels.data[i]! >= 50 &&
            pixels.data[i]! < 200 &&
            pixels.data[i + 1]! > 90 &&
            pixels.data[i + 1]! < 230
          )
            imagePixels++;
        }
        expect(imagePixels).toBeGreaterThan(30000);
      }
      await writeFile(`artifacts/chat/${name}.${format}`, result.body);
    }
  }
});

it('renders an empty chat and allows hiding the input decoration', async () => {
  const data = { title: '聊天', messages: [] };
  const withInput = await renderer.render({ template: 'chat', data, format: 'svg' });
  const withoutInput = await renderer.render({ template: 'chat', data: { ...data, showInput: false }, format: 'svg' });
  expect(withInput.height - withoutInput.height).toBe(48);
  const png = await renderer.render({ template: 'chat', data, format: 'png' });
  expect(png.warnings).toEqual([]);
  await writeFile('artifacts/chat/empty.png', png.body);
});
