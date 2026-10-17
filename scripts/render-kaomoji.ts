import './prepare-satori.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { Renderer } from '../src/core/renderer.js';
import type { RenderRequest } from '../src/core/request.js';
import { createTemplateRegistry } from '../src/templates/index.js';

// Real production templates and PNG pipeline; keep the original zero-width space.
const faces = [
  '߹꒳\u200b߹',
  '(´；ω；｀)',
  '(´・ω・`)',
  '(๑•̀ㅂ•́)و✧',
  '٩(ˊᗜˋ*)و',
  '(ง •̀_•́)ง',
  '(っ˘ω˘ς )',
  '(｡•́︿•̀｡)',
  '(づ｡◕‿‿◕｡)づ',
  '(╯°□°）╯︵ ┻━┻',
  '¯\\_(ツ)_/¯',
  '(ʘ‿ʘ)',
  '(っ ॑꒳ ॑c)',
  '(੭ु ›ω‹ )੭ु⁾⁾',
  '( ˶ˆᗜˆ˵ )',
];
const directory = resolve(process.argv[2] ?? 'artifacts/kaomoji');
await mkdir(directory, { recursive: true });
const config = loadConfig({ ...process.env, LOG_LEVEL: 'silent' });
const fonts = await loadFonts(config.fontConfig);
const registry = createTemplateRegistry();
const renderers = {
  before: new Renderer(
    config,
    {
      fonts: fonts.fonts.filter(font => font.name !== 'Go Noto Current'),
      fontFamily: fonts.fontFamily.replace(', Go Noto Current', ''),
      monospaceFontFamily: fonts.monospaceFontFamily.replace(', Go Noto Current', ''),
    },
    registry,
  ),
  after: new Renderer(config, fonts, registry),
};
const samples: { name: string; request: RenderRequest }[] = [
  {
    name: 'target',
    request: { template: 'example', format: 'png', data: { text: '߹꒳\u200b߹' } },
  },
  ...[false, true].map(monospace => ({
    name: monospace ? 'monospace' : 'body',
    request: {
      template: 'example',
      format: 'png' as const,
      data: { text: faces.map((face, index) => `${index + 1}.  ${face}`).join('\n'), monospace },
    },
  })),
  {
    name: 'article',
    request: {
      template: 'article',
      format: 'png',
      data: {
        title: '颜文字 ߹꒳\u200b߹',
        content: [
          '中文、日本語、English 和颜文字混排：߹꒳\u200b߹ (๑•̀ㅂ•́)و✧',
          '**粗体 ߹꒳\u200b߹ ٩(ˊᗜˋ*)و**，*斜体 (ง •̀_•́)ง*，`等宽 (っ ॑꒳ ॑c)`。',
          '长文本换行：' + '今日はありがとう ߹꒳\u200b߹ 中文加油 (ง •̀_•́)ง！'.repeat(14),
          '```text\n' + faces.slice(0, 6).join('\n') + '\n```',
          '原有字符：中文 日本語 한국어 Hello ⏻ 𓀀 𖤐 𒀀 🐶🧡 👩‍💻',
        ].join('\n\n'),
      },
    },
  },
  {
    name: 'social-post',
    request: {
      template: 'social_post',
      format: 'png',
      data: {
        author: { name: 'ありがとう ߹꒳\u200b߹', handle: 'kaomoji' },
        content: '今日もありがとう ߹꒳\u200b߹\n\n٩(ˊᗜˋ*)و (๑•̀ㅂ•́)و✧\n中文、日本語、English 🐶🧡',
      },
    },
  },
];
const results = [];
for (const [variant, renderer] of Object.entries(renderers)) {
  for (const { name, request } of samples) {
    const png = await renderer.render(request);
    const svg = await renderer.render({ ...request, format: 'svg' });
    assert.deepEqual([png.width, png.height], [svg.width * 2, svg.height * 2]);
    assert.deepEqual(png.warnings, svg.warnings);
    if (variant === 'after') assert.deepEqual(png.warnings, []);
    else assert.deepEqual(png.warnings, ['MISSING_GLYPH']);
    const path = resolve(directory, `${variant}-${name}`);
    await writeFile(path + '.png', png.body);
    await writeFile(path + '.svg', svg.body);
    results.push({ variant, name, width: png.width, height: png.height, warnings: png.warnings });
  }
}
// Existing text should remain byte-identical, including Ancient and color emoji.
for (const monospace of [false, true]) {
  for (const format of ['png', 'svg'] as const) {
    const request = {
      template: 'example',
      data: { text: '中文 日本語 한국어 Hello ⏻ 𓀀 𖤐 𒀀 🐶🧡 👩‍💻', monospace },
      format,
    };
    const before = await renderers.before.render(request);
    const after = await renderers.after.render(request);
    assert.deepEqual(after.warnings, []);
    assert.ok(
      Buffer.from(after.body).equals(before.body),
      `Existing text changed: monospace=${monospace}, format=${format}`,
    );
  }
}
const before = await sharp(resolve(directory, 'before-body.png')).metadata();
const after = await sharp(resolve(directory, 'after-body.png')).metadata();
await sharp({
  create: {
    width: before.width! + after.width!,
    height: Math.max(before.height!, after.height!),
    channels: 4,
    background: '#f5f5f5',
  },
})
  .composite([
    { input: resolve(directory, 'before-body.png'), left: 0, top: 0 },
    { input: resolve(directory, 'after-body.png'), left: before.width!, top: 0 },
  ])
  .png()
  .toFile(resolve(directory, 'before-after.png'));
await writeFile(resolve(directory, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ directory, results, unchangedBaseline: true }, null, 2));
