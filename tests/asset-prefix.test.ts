import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { toNodeHandler } from 'h3/node';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOptions } from '../scripts/build-options.js';
import { createApp } from '../src/api/app.js';
import { loadConfig } from '../src/config.js';
import { RenderPool } from '../src/core/pool.js';
import { createTemplateRegistry } from '../src/templates/index.js';

const config = loadConfig({ LOG_LEVEL: 'silent', RENDER_CONCURRENCY: '1', NODE_ENV: 'production' });
const registry = createTemplateRegistry();
let pool: RenderPool;
let api: Server;
let assets: Server;
let origin: string;
let assetOrigin: string;
const downloads: string[] = [];
const pixel = new PNG({ width: 80, height: 40 });
for (let offset = 0; offset < pixel.data.length; offset += 4) pixel.data.set([25, 150, 200, 255], offset);
const png = PNG.sync.write(pixel);

async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  return 'http://127.0.0.1:' + address.port;
}
const post = (body: unknown) =>
  fetch(origin + '/v1/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  assets = createServer((request, response) => {
    downloads.push(request.url!);
    if (/^\/static\/(avatar|body|translation|media|cover|quote|before|after)\.png(?:\?|$)/.test(request.url!)) {
      response.writeHead(200, { 'Content-Type': 'image/png' });
      response.end(png);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  assetOrigin = await listen(assets);
  await build({ ...buildOptions, entryPoints: ['src/worker.ts'], outfile: '.dev/asset-prefix-worker.js' });
  pool = new RenderPool(config, pathToFileURL(resolve('.dev/asset-prefix-worker.js')));
  await pool.start();
  api = createServer(toNodeHandler(createApp(config, pool, registry)));
  origin = await listen(api);
});

afterAll(async () => {
  await pool?.close();
  for (const server of [api, assets]) {
    if (!server) continue;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

const cases = [
  {
    template: 'article',
    images: 4,
    data: (url: (path: string) => string) => ({
      title: '资源前缀 · 日本語 English',
      author: '作者',
      authorAvatarUrl: url('/avatar.png'),
      content: '正文图片 ![正文](' + url('body.png?v=2') + ')',
      translation: { text: '翻译图片 ![译文](' + url('translation.png') + ')' },
      media: [{ url: url('media.png') }],
    }),
  },
  {
    template: 'social_post',
    images: 4,
    data: (url: (path: string) => string) => ({
      author: { name: '作者', avatarUrl: url('avatar.png') },
      content: '视频预览 日本語 English',
      postKind: 'quote',
      media: [{ type: 'video', url: url('video.mp4'), previewUrl: url('/cover.png') }],
      quotedPost: { author: { name: '引用作者', avatarUrl: url('avatar.png') }, media: [{ url: url('quote.png') }] },
    }),
  },
  {
    template: 'comparison',
    images: 2,
    data: (url: (path: string) => string) => ({
      title: '图片对比',
      modules: [{ type: 'image', before: { url: url('/before.png') }, after: { url: url('after.png') } }],
    }),
  },
];

describe('asset prefix through HTTP and production worker', () => {
  it.each(cases)(
    'renders $template paths identically to complete URLs in PNG and SVG',
    async ({ template, data, images }) => {
      for (const format of ['svg', 'png']) {
        const relative = await post({
          template,
          data: data(path => path),
          format,
          assetUrlPrefix: assetOrigin + '/static',
        });
        expect(relative.status).toBe(200);
        expect(relative.headers.get('X-Render-Warnings')).toBe('');
        const body = Buffer.from(await relative.arrayBuffer());
        const absolute = await post({
          template,
          data: data(path => assetOrigin + '/static/' + path.replace(/^\//, '')),
          format,
        });
        expect(absolute.status).toBe(200);
        expect(body.equals(Buffer.from(await absolute.arrayBuffer()))).toBe(true);
        const scale = format === 'png' ? 2 : 1;
        expect(Number(relative.headers.get('X-Image-Width'))).toBe(
          Number(relative.headers.get('X-Layout-Width')) * scale,
        );
        expect(Number(relative.headers.get('X-Image-Height'))).toBe(
          Number(relative.headers.get('X-Layout-Height')) * scale,
        );
        if (format === 'svg') expect(body.toString().match(/data:image\/png;base64,/g)).toHaveLength(images);
        else {
          const image = PNG.sync.read(body);
          expect([image.width, image.height]).toEqual([
            Number(relative.headers.get('X-Image-Width')),
            Number(relative.headers.get('X-Image-Height')),
          ]);
        }
      }
      expect(downloads.some(url => url.includes('video.mp4'))).toBe(false);
    },
  );

  it('keeps complete URLs unchanged and shares their cached downloads', async () => {
    const path = '/static/body.png?cache=complete';
    const data = { content: '![image](' + assetOrigin + path + ')' };
    const initial = await post({ template: 'article', data, format: 'svg' });
    expect(initial.status).toBe(200);
    await initial.arrayBuffer();
    expect(downloads.filter(url => url === path)).toHaveLength(1);
    const response = await post({
      template: 'article',
      data,
      format: 'svg',
      assetUrlPrefix: 'https://unused.invalid/',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Render-Warnings')).toBe('');
    expect(downloads.filter(url => url === path)).toHaveLength(1);
  });

  it('keeps successful images when a path is missing and warns without a prefix', async () => {
    for (const format of ['svg', 'png']) {
      for (const assetUrlPrefix of [assetOrigin + '/static/', '', undefined]) {
        const response = await post({
          template: 'article',
          format,
          assetUrlPrefix,
          data: { content: '![missing](missing.png)', media: [{ url: assetOrigin + '/static/media.png' }] },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Render-Warnings')).toBe('IMAGE_UNAVAILABLE');
        const body = Buffer.from(await response.arrayBuffer());
        if (format === 'svg') expect(body.toString().match(/<image\b/g)).toHaveLength(1);
        else expect(PNG.sync.read(body).width).toBe(1400);
      }
    }
  });

  it('rejects an invalid prefix at the HTTP boundary and leaves the worker healthy', async () => {
    const response = await post({ template: 'example', data: { text: 'test' }, assetUrlPrefix: 'file:///tmp/' });
    expect(response.status).toBe(400);
    expect((await response.json()).error.details[0].path).toEqual(['assetUrlPrefix']);
    const health = await fetch(origin + '/healthz');
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', workers: 1 });
  });
});
