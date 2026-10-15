// Build first. Compare isolated processes using the production worker and identical requests.
// pnpm exec tsx scripts/verify-font-fallback.ts [output-directory]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MessageChannel, Worker } from 'node:worker_threads';
import { loadConfig } from '../src/config.js';
import type { RenderRequest, RenderResult } from '../src/core/types.js';

const directory = resolve(process.argv[2] ?? 'artifacts/ancient-fallback');
const samples = [
  { name: 'existing', text: '中文 日本語 한국어 Hello café 0123 ⏻ 🎉\n埃及象形文字 𓀀 𓂀 𓆣 𓋹' },
  {
    name: 'ancient',
    text: '末级字体回退 Ancient fallback\n巴姆文字 𖤐 𖤐𖤐𖤐\n楔形文字 𒀀 𒀁 𒀂\n乌加里特 𐎀 𐎁 𐎂\n哥特文字 𐌰 𐌱 𐌲\n原有字体 中文 日本語 한국어 Hello 𓀀 🎉',
  },
  { name: 'long', text: '长文本 中文 English 𖤐 𒀀 𐎀 𐌰 😀 '.repeat(30) },
];
const requests = samples.flatMap(sample =>
  [false, true].flatMap(monospace =>
    (['svg', 'png'] as const).map(format => ({
      name: sample.name + (monospace ? '-mono' : '-body') + '.' + format,
      request: { template: 'example', format, data: { text: sample.text, monospace } } satisfies RenderRequest,
    })),
  ),
);

if (process.argv[3] === 'child') {
  const [variant, count, trial] = process.argv.slice(4);
  const config = loadConfig({ LOG_LEVEL: 'silent', FONT_CONFIG: resolve(directory, variant + '-fonts.json') });
  const workers: Worker[] = [];
  const ports: MessageChannel['port1'][] = [];
  const once = <T>(port: Worker | MessageChannel['port1']) =>
    new Promise<T>((accept, reject) => {
      const receive = (value: T) => {
        port.off('error', fail);
        accept(value);
      };
      const fail = (error: Error) => {
        port.off('message', receive);
        reject(error);
      };
      port.once('message', receive);
      port.once('error', fail);
    });
  const memory = async () => {
    const heaps = await Promise.all(
      ports.map(async port => {
        const next = once<NodeJS.MemoryUsage>(port);
        port.postMessage('sample');
        return next;
      }),
    );
    global.gc?.();
    return { rss: process.memoryUsage().rss, workers: heaps.map(({ rss: _rss, ...heap }) => heap) };
  };
  const start = performance.now();
  const beforeRss = process.memoryUsage().rss;
  try {
    for (let i = 0; i < Number(count); i++) {
      const { port1, port2 } = new MessageChannel();
      ports.push(port1);
      const worker = new Worker(pathToFileURL(resolve(directory, 'probe-worker.mjs')), {
        workerData: { ...config, probePort: port2 },
        transferList: [port2],
      });
      workers.push(worker);
      assert.deepEqual(await once(worker), { ready: true });
    }
    const startupMs = performance.now() - start;
    const ready = await memory();
    const outputs = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const { name, request } of requests) {
        const results = await Promise.all(
          workers.map(async worker => {
            const next = once<{ result?: RenderResult; error?: unknown }>(worker);
            worker.postMessage(request);
            const message = await next;
            assert.ok(message.result, JSON.stringify(message.error));
            return message.result;
          }),
        );
        if (pass === 0) {
          const result = results[0]!;
          outputs.push({ name, width: result.width, height: result.height, warnings: result.warnings });
          if (trial === '0' && count === '1') {
            await writeFile(resolve(directory, variant + '-' + name), result.body);
          }
          if (variant === 'current') assert.deepEqual(result.warnings, []);
        }
      }
    }
    const rendered = await memory();
    console.log(
      JSON.stringify({
        variant,
        count: Number(count),
        trial: Number(trial),
        beforeRss,
        startupMs,
        ready,
        rendered,
        peakRss: process.resourceUsage().maxRSS * 1024,
        rendersPerWorker: requests.length * 3,
        outputs,
      }),
    );
  } finally {
    for (const port of ports) port.close();
    await Promise.all(workers.map(worker => worker.terminate()));
  }
} else {
  await mkdir(directory, { recursive: true });
  const fonts = JSON.parse(await readFile('fonts/fonts.json', 'utf8')) as { name: string; path: string }[];
  const current = fonts.map(font => ({ ...font, path: resolve('fonts', font.path) }));
  await writeFile(resolve(directory, 'current-fonts.json'), JSON.stringify(current));
  await writeFile(
    resolve(directory, 'baseline-fonts.json'),
    JSON.stringify(current.filter(font => font.name !== 'Go Noto Ancient')),
  );
  // A separate MessagePort samples the worker isolate without changing the production message protocol.
  await writeFile(
    resolve(directory, 'probe-worker.mjs'),
    `
import { workerData } from 'node:worker_threads';
workerData.probePort.on('message', () => {
  if (!global.gc) throw new Error('Run the probe with --expose-gc');
  global.gc();
  workerData.probePort.postMessage(process.memoryUsage());
});
await import(${JSON.stringify(pathToFileURL(resolve('dist/worker.js')).href)});
`,
  );
  const evidence: object[] = [];
  for (let trial = 0; trial < 3; trial++) {
    for (const count of [1, 2]) {
      for (const variant of trial % 2 ? ['current', 'baseline'] : ['baseline', 'current']) {
        const output = execFileSync(
          process.execPath,
          [
            '--expose-gc',
            '--import',
            'tsx',
            fileURLToPath(import.meta.url),
            directory,
            'child',
            variant,
            String(count),
            String(trial),
          ],
          { encoding: 'utf8', timeout: 120_000 },
        );
        evidence.push(JSON.parse(output));
        await writeFile(
          resolve(directory, 'memory.json'),
          JSON.stringify(
            {
              node: process.version,
              platform: process.platform,
              arch: process.arch,
              note: 'Fresh process per trial; GC before snapshots. RSS is process-wide; heap/external fields are per worker. Peak RSS includes transient allocations.',
              evidence,
            },
            null,
            2,
          ) + '\n',
        );
        console.log('Completed', variant, count, 'workers, trial', trial + 1);
      }
    }
  }
  for (const { name } of requests.filter(({ name }) => name.startsWith('existing'))) {
    assert.deepEqual(
      await readFile(resolve(directory, 'current-' + name)),
      await readFile(resolve(directory, 'baseline-' + name)),
    );
  }
  console.log('Existing-text PNG and SVG are byte-identical. Evidence:', directory);
}
