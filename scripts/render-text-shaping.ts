import './prepare-satori.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { Renderer } from '../src/core/renderer.js';
import type { RenderRequest } from '../src/core/request.js';
import { svgDimensions } from '../src/core/sizing.js';
import { createTemplateRegistry } from '../src/templates/index.js';

// With a URL, exercise the built HTTP service and worker instead of the local Renderer.
const directory = resolve(process.argv[2] ?? 'artifacts/text-shaping');
const baseUrl = process.argv[3];
await mkdir(directory, { recursive: true });
const config = loadConfig({ ...process.env, LOG_LEVEL: 'silent' });
const renderer = baseUrl
  ? undefined
  : new Renderer(config, await loadFonts(config.fontConfig), createTemplateRegistry());
const text = [
  '01. ߹꒳\u200b߹ 中文 English 🧡',
  '02. (っ ॑꒳ ॑c)',
  '03. (੭ु ›ω‹ )੭ु⁾⁾',
  '04. ( ˶ˆᗜˆ˵ )',
  '05. x\u0301 x\u0301\u0302 a\u0324 a\u0301\u0324',
  '06. مرحبا 🧡 بالعالم 123',
  '07. שלום 🧡 עולם 123',
  '08. 中文 English שלום עולם 123 مرحبا بالعالم',
  '09. ߹꒳\u200b߹ ' + '中文ありがとう ߹꒳\u200b߹ 🧡 '.repeat(12),
  '10. End — 编号不串行',
].join('\n');
const samples: { name: string; request: RenderRequest }[] = [
  ...[false, true].map(monospace => ({
    name: monospace ? 'monospace' : 'body',
    request: { template: 'example', data: { text, monospace }, format: 'png' as const },
  })),
  {
    name: 'article',
    request: {
      template: 'article',
      format: 'png',
      data: {
        title: '多行颜文字与 RTL',
        content:
          '߹꒳\u200b߹ 中文 English 🧡\n\n' +
          '**粗体 (っ ॑꒳ ॑c)**，*斜体 (੭ु ›ω‹ )੭ु⁾⁾*，`x́̂ a̤`。\n\n' +
          '**שלום** 🧡 *עולם* 123\n\n**مرحبا** 🧡 *بالعالم* 123\n\n' +
          '自动换行：' +
          '中文ありがとう ߹꒳\u200b߹ 🧡 '.repeat(20),
      },
    },
  },
];
const records = [];
for (const { name, request } of samples) {
  const images: Partial<Record<'png' | 'svg', Buffer>> = {};
  for (const format of ['png', 'svg'] as const) {
    let body: Buffer;
    let warnings: string[];
    if (baseUrl) {
      const response = await fetch(new URL('/v1/render', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...request, format }),
      });
      body = Buffer.from(await response.arrayBuffer());
      assert.equal(response.status, 200, body.toString());
      warnings = (response.headers.get('x-render-warnings') ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else {
      const result = await renderer!.render({ ...request, format });
      body = Buffer.from(result.body);
      warnings = result.warnings;
    }
    assert.deepEqual(warnings, []);
    images[format] = body;
    await writeFile(resolve(directory, `${name}.${format}`), body);
  }
  const png = await sharp(images.png!).metadata();
  const svg = svgDimensions(images.svg!.toString());
  assert.deepEqual([png.width, png.height], [svg.width * 2, svg.height * 2]);
  records.push({ name, png: [png.width, png.height], svg: [svg.width, svg.height], warnings: [] });
}
await writeFile(
  resolve(directory, 'results.json'),
  JSON.stringify({ mode: baseUrl ? 'HTTP/worker' : 'Renderer', records }, null, 2),
);
console.log(JSON.stringify({ directory, records }, null, 2));
