// Build first; this script exercises the production child-process pool.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../src/config.js';
import { RenderPool } from '../src/core/pool.js';

const directory = resolve(process.argv[2] ?? 'artifacts/font-fallback');
await mkdir(directory, { recursive: true });
const fonts = JSON.parse(await readFile('fonts/fonts.json', 'utf8')) as { name: string; path: string }[];
const current = fonts.map(font => ({ ...font, path: resolve('fonts', font.path) }));
const records = [];
for (const variant of ['baseline', 'current']) {
  const path = resolve(directory, variant + '-fonts.json');
  await writeFile(
    path,
    JSON.stringify(variant === 'current' ? current : current.filter(font => font.name !== 'Go Noto Ancient')),
  );
  const config = loadConfig({ LOG_LEVEL: 'silent', FONT_CONFIG: path, RENDER_CONCURRENCY: '1' });
  const pool = new RenderPool(config, pathToFileURL(resolve('dist/worker.js')));
  const started = performance.now();
  await pool.start();
  const startupMs = performance.now() - started;
  try {
    for (const monospace of [false, true]) {
      const result = await pool.render({
        template: 'example',
        format: 'png',
        data: { text: '中文 日本語 한국어 Hello café ⏻ 𓀀 🎉\n𖤐 𒀀 𐎀 𐌰', monospace },
      });
      assert.deepEqual(result.warnings, variant === 'current' ? [] : ['MISSING_GLYPH']);
      await writeFile(resolve(directory, `${variant}-${monospace ? 'mono' : 'body'}.png`), result.body);
      records.push({
        variant,
        monospace,
        startupMs,
        width: result.width,
        height: result.height,
        warnings: result.warnings,
      });
    }
  } finally {
    await pool.close();
  }
}
await writeFile(resolve(directory, 'results.json'), JSON.stringify(records, null, 2));
console.log(directory);
