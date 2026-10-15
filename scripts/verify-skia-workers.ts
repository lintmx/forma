// Local real-worker stress run. Build first; writes evidence outside the source tree.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../src/config.js';
import { RenderPool } from '../src/core/pool.js';
import type { RenderRequest } from '../src/core/request.js';

const out = process.argv[2] ?? 'artifacts/skia-migration/workers.json';
const worker = pathToFileURL(resolve(process.argv[3] ?? 'dist/worker.js'));
const small: RenderRequest = { template: 'example', format: 'png', data: { text: '中文 日本語 한국어 Memory 😀' } };
const large: RenderRequest = { ...small, data: { text: '中文 日本語 한국어 Fixed 2x 😀\n'.repeat(12) } };
const evidence: object[] = [];
const sample = () => ({
  time: Date.now(),
  ...process.memoryUsage(),
  processPeakRssKiB: process.resourceUsage().maxRSS,
});
for (const concurrency of (process.argv[4] ?? '1,2,4').split(',').map(Number)) {
  const config = loadConfig({ LOG_LEVEL: 'silent', RENDER_CONCURRENCY: String(concurrency), RENDER_QUEUE_LIMIT: '8' });
  const pool = new RenderPool(config, worker);
  const latencies: number[] = [],
    memory: object[] = [];
  let cancelled = 0,
    timedOut = 0;
  try {
    const started = performance.now();
    await pool.start();
    const startupMs = performance.now() - started;
    for (let i = 0; i < 20; i++) await pool.render(small);
    memory.push(sample());
    for (let batch = 0; batch < 1000 / concurrency; batch++) {
      await Promise.all(
        Array.from({ length: concurrency }, async (_, slot) => {
          const sequence = batch * concurrency + slot;
          const request = sequence % 25 === 0 ? large : small;
          const start = performance.now();
          const result = await pool.render(request);
          latencies.push(performance.now() - start);
          assert.equal(result.scale, 2);
          assert.equal(Buffer.from(result.body).subarray(1, 4).toString(), 'PNG');
        }),
      );
      if (batch % Math.max(1, Math.floor(50 / concurrency)) === 0) memory.push(sample());
    }
    console.log('completed renders', concurrency, latencies.length);
    // Queue pressure and real in-flight native rendering; no mock worker.
    const attempts = Array.from({ length: concurrency + 12 }, () =>
      pool.render(large).then(
        () => 'ok',
        e => e.code,
      ),
    );
    assert.ok((await Promise.all(attempts)).includes('BUSY'));
    for (let i = 0; i < 12; i++) {
      const abort = new AbortController();
      const active = pool.render(large, abort.signal, 15000).catch(e => e);
      await delay(20);
      abort.abort();
      const result = await active;
      if (result.code === 'CANCELLED') cancelled++;
      const recovery = Date.now() + 15000;
      while (pool.stats.workers !== concurrency && Date.now() < recovery) await delay(20);
      assert.equal(pool.stats.workers, concurrency);
      const timeout = await pool.render(large, undefined, 2).catch(e => e);
      if (timeout.code === 'RENDER_TIMEOUT') timedOut++;
      const deadline = Date.now() + 15000;
      while (pool.stats.workers !== concurrency && Date.now() < deadline) await delay(20);
      assert.equal(pool.stats.workers, concurrency);
      assert.equal((await pool.render(small)).format, 'png');
    }
    assert.ok(cancelled > 0);
    assert.ok(timedOut > 0);
    await assert.rejects(pool.render({ ...large, data: { text: 'line\n'.repeat(100) } }), { code: 'SIZE_LIMIT' });
    memory.push(sample());
    await delay(2000);
    memory.push(sample());
    const cpu = process.cpuUsage();
    await delay(500);
    const idleCpu = process.cpuUsage(cpu);
    const sorted = latencies.toSorted((a, b) => a - b);
    evidence.push({
      concurrency,
      startupMs,
      renders: latencies.length,
      p50: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      cancelled,
      timedOut,
      idleCpuMicroseconds: idleCpu,
      memory,
      stats: pool.stats,
    });
  } finally {
    await pool.close();
  }
  assert.equal(pool.stats.workers, 0);
  await assert.rejects(pool.render(small), { code: 'UNAVAILABLE' });
  await mkdir(resolve(out, '..'), { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      { platform: process.platform, arch: process.arch, node: process.version, worker: worker.href, evidence },
      null,
      2,
    ),
  );
  console.log('completed concurrency', concurrency);
}
