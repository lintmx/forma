import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from '../src/api/app.js';
import { loadConfig } from '../src/config.js';
import { RenderPool } from '../src/core/pool.js';
import { registry } from '../src/templates/index.js';

const config = loadConfig({ LOG_LEVEL: 'silent', RENDER_CONCURRENCY: '1', NODE_ENV: 'production' });
let pool: RenderPool;

beforeAll(async () => {
  await build({
    entryPoints: ['src/core/worker.ts'],
    outfile: '.dev/templates-test-worker.js',
    bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22',
  });
  pool = new RenderPool(config, pathToFileURL(resolve('.dev/templates-test-worker.js')));
  await pool.start();
});
afterAll(async () => { await pool?.close(); });

describe('production template catalog', () => {
  it('starts real workers and serves example as the default template', async () => {
    expect(registry.list().map(template => template.id)).toEqual(['example']);
    const app = createApp(config, pool);
    const health = await app.fetch(new Request('http://localhost/healthz'));
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', workers: 1 });
    const list = await app.fetch(new Request('http://localhost/v1/templates'));
    expect(list.status).toBe(200);
    const { templates } = await list.json();
    expect(templates.map((template: { id: string }) => template.id)).toEqual(['example']);
    const metadata = await app.fetch(new Request('http://localhost/v1/templates/example'));
    expect(metadata.status).toBe(200);
    const data = await metadata.json();
    expect(data.schema.required).toEqual(['text']);
    expect(Object.keys(data.schema.properties)).toEqual(['text']);
    expect(data.mock).toEqual(registry.get('example').mock);
  });

  it.each(['notice', 'profile', 'test-content', 'test-auto-height'])(
    'does not expose or render the unregistered template %s',
    async template => {
      const app = createApp(config, pool);
      for (const suffix of ['', '.txt']) {
        const response = await app.fetch(new Request('http://localhost/v1/templates/' + template + suffix));
        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('TEMPLATE_NOT_FOUND');
      }
      const response = await app.fetch(new Request('http://localhost/v1/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, data: {} }),
      }));
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe('TEMPLATE_NOT_FOUND');
      await expect(pool.render({ template, data: {}, format: 'svg' })).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND', status: 404 });
      expect(pool.healthy).toBe(true);
    },
  );
});
