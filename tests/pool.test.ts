import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { RenderPool } from '../src/core/pool.js';

// This fixture deliberately blocks JS, so a Promise.race-only timeout would fail.
const worker = new URL(
  'data:text/javascript,' +
    encodeURIComponent(`
  import { parentPort } from 'node:worker_threads';
  parentPort.postMessage({ ready: true });
  parentPort.on('message', ({ request, attachments }) => {
    if (request.data === 'hang') { while (true) {} }
    parentPort.postMessage({ result: { body: attachments?.get('cover') ?? new Uint8Array([1]), width: 1, height: 1, format: 'png', warnings: [] } });
  });
`),
);
const pools: RenderPool[] = [];
afterEach(async () => {
  await Promise.all(pools.splice(0).map(p => p.close()));
});
async function makePool() {
  const pool = new RenderPool(
    loadConfig({ RENDER_CONCURRENCY: '1', RENDER_QUEUE_LIMIT: '1', RENDER_TIMEOUT_MS: '500', LOG_LEVEL: 'silent' }),
    worker,
  );
  pools.push(pool);
  await pool.start();
  return pool;
}
describe('bounded worker pool', () => {
  it('rejects saturation, terminates timed-out work and recovers for the next request', async () => {
    const pool = await makePool();
    const first = pool.render({ template: 'test', data: 'hang', format: 'png' }, undefined, 100).catch(e => e);
    const queued = pool.render({ template: 'test', data: 'ok', format: 'png' }, undefined, 2000);
    await expect(pool.render({ template: 'test', data: 'ok', format: 'png' })).rejects.toMatchObject({ code: 'BUSY' });
    expect((await first).code).toBe('RENDER_TIMEOUT');
    expect((await queued).width).toBe(1);
    expect(pool.stats.active).toBe(0);
  });
  it('passes binary attachments and discards cancelled queued uploads', async () => {
    const pool = await makePool();
    const request = { template: 'test', data: 'ok', format: 'png' as const };
    const bytes = new Uint8Array([0, 255, 13, 10]);
    const rendered = await pool.render(request, undefined, 2000, new Map([['cover', bytes]]));
    expect(rendered.body).toEqual(bytes);
    const active = new AbortController();
    const queued = new AbortController();
    const hanging = pool.render({ ...request, data: 'hang' }, active.signal, 2000).catch(error => error);
    const pending = pool.render(request, queued.signal, 2000, new Map([['cover', bytes]])).catch(error => error);
    queued.abort();
    expect((await pending).code).toBe('CANCELLED');
    expect(pool.stats.queued).toBe(0);
    active.abort();
    expect((await hanging).code).toBe('CANCELLED');
    await expect.poll(() => pool.healthy, { timeout: 2000 }).toBe(true);
    const next = await pool.render(request, undefined, 2000);
    expect(next.body).toEqual(new Uint8Array([1]));
  });
  it('includes queue time in deadlines and cancels disconnected requests', async () => {
    const pool = await makePool();
    const controller = new AbortController();
    const first = pool.render({ template: 'test', data: 'hang', format: 'png' }, controller.signal).catch(e => e);
    await expect(pool.render({ template: 'test', data: 'ok', format: 'png' }, undefined, 30)).rejects.toMatchObject({
      code: 'RENDER_TIMEOUT',
    });
    controller.abort();
    expect((await first).code).toBe('CANCELLED');
    expect(pool.stats.queued).toBe(0);
  });
});
