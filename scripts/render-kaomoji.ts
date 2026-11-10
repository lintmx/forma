import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
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
      fontFamily: fonts.fontFamily.replace(', "Go Noto Current"', ''),
      monospaceFontFamily: fonts.monospaceFontFamily.replace(', "Go Noto Current"', ''),
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
    assert.deepEqual([png.width, png.height], [png.layoutWidth * 2, png.layoutHeight * 2]);
    if (variant === 'after') assert.deepEqual(png.warnings, []);
    else assert.deepEqual(png.warnings, ['MISSING_GLYPH']);
    const path = resolve(directory, `${variant}-${name}`);
    await writeFile(path + '.png', png.body);
    results.push({ variant, name, width: png.width, height: png.height, warnings: png.warnings });
  }
}
// Existing multilingual text remains covered after adding the fallback family.
for (const monospace of [false, true]) {
  const request = {
    template: 'example',
    data: { text: '中文 日本語 한국어 Hello ⏻ 𓀀 𖤐 𒀀 🐶🧡 👩‍💻', monospace },
    format: 'png' as const,
  };
  const before = await renderers.before.render(request);
  const after = await renderers.after.render(request);
  assert.deepEqual(after.warnings, []);
  assert.deepEqual(before.warnings, []);
  assert.equal(after.width, before.width);
}
const before = PNG.sync.read(await readFile(resolve(directory, 'before-body.png')));
const after = PNG.sync.read(await readFile(resolve(directory, 'after-body.png')));
const comparison = new PNG({ width: before.width + after.width, height: Math.max(before.height, after.height) });
comparison.data.fill(Buffer.from([245, 245, 245, 255]));
PNG.bitblt(before, comparison, 0, 0, before.width, before.height, 0, 0);
PNG.bitblt(after, comparison, 0, 0, after.width, after.height, before.width, 0);
await writeFile(resolve(directory, 'before-after.png'), PNG.sync.write(comparison));
await writeFile(resolve(directory, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ directory, results, baselineCoverageVerified: true }, null, 2));
