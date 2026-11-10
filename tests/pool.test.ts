import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { RenderPool } from '../src/core/pool.js';

const worker = new URL('./fixtures/pool-worker.mjs', import.meta.url);
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
  it('settles startup when closed before its worker becomes ready', async () => {
    const pool = new RenderPool(loadConfig({ RENDER_CONCURRENCY: '1', LOG_LEVEL: 'silent' }), worker);
    pools.push(pool);
    const starting = pool.start().catch(error => error);
    await pool.close();
    expect(await starting).toMatchObject({ code: 'UNAVAILABLE' });
    expect(pool.healthy).toBe(false);
    expect(pool.stats).toEqual({ workers: 0, active: 0, queued: 0 });
  });
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

it.each(['cancel', 'timeout', 'close'] as const)(
  'kills active native work on %s before restoring capacity',
  async action => {
    const pool = await makePool();
    const directory = await mkdtemp(join(tmpdir(), 'forma-native-'));
    const started = join(directory, 'started');
    const controller = new AbortController();
    try {
      const active = pool
        .render(
          { template: 'test', data: { native: true, started }, format: 'png' },
          controller.signal,
          action === 'timeout' ? 500 : 5000,
        )
        .catch(error => error);
      let pid = 0;
      await expect
        .poll(
          async () => {
            try {
              pid = Number(await readFile(started, 'utf8'));
              return pid > 0;
            } catch {
              return false;
            }
          },
          { timeout: 2000 },
        )
        .toBe(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      const begin = performance.now();
      if (action === 'cancel') controller.abort();
      if (action === 'close') await pool.close();
      expect((await active).code).toBe(
        action === 'cancel' ? 'CANCELLED' : action === 'timeout' ? 'RENDER_TIMEOUT' : 'UNAVAILABLE',
      );
      await expect
        .poll(
          () => {
            try {
              process.kill(pid, 0);
              return false;
            } catch {
              return true;
            }
          },
          { timeout: 2000 },
        )
        .toBe(true);
      expect(performance.now() - begin).toBeLessThan(2000);
      if (action !== 'close') {
        await expect.poll(() => pool.healthy, { timeout: 2000 }).toBe(true);
        expect((await pool.render({ template: 'test', data: 'ok', format: 'png' })).layoutWidth).not.toBe(pid);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it('recovers repeatedly from unexpected worker exits without increasing capacity', async () => {
  const pool = await makePool();
  const retired: number[] = [];
  for (let i = 0; i < 4; i++) {
    retired.push((await pool.render({ template: 'test', data: 'ok', format: 'png' })).layoutWidth);
    const crash = pool
      .render({ template: 'test', data: 'crash', format: 'png' }, undefined, 2000)
      .catch(error => error);
    const queued = pool.render({ template: 'test', data: 'ok', format: 'png' }, undefined, 2000);
    expect((await crash).code).toBe('WORKER_FAILED');
    expect(retired).not.toContain((await queued).layoutWidth);
    expect(pool.stats).toEqual({ workers: 1, active: 0, queued: 0 });
  }
  await pool.close();
  for (const pid of retired) expect(() => process.kill(pid, 0)).toThrow();
});
