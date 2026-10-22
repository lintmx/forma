import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { toNodeHandler } from 'h3/node';
import { PNG } from 'pngjs';
import { createElement } from 'react';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildOptions } from '../scripts/build-options.js';
import { createApp, readJson } from '../src/api/app.js';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { RenderPool } from '../src/core/pool.js';
import { TemplateRegistry } from '../src/core/registry.js';
import { Renderer } from '../src/core/renderer.js';
import { createTemplateRegistry } from '../src/templates/index.js';
import { registerTestTemplates } from './fixtures/templates.js';

const registry = createTemplateRegistry();
const config = loadConfig({
  LOG_LEVEL: 'silent',
  RENDER_CONCURRENCY: '1',
  NODE_ENV: 'production',
});
let pool: RenderPool;
let server: Server;
let origin: string;
const post = (data: unknown) =>
  fetch(origin + '/v1/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
beforeAll(async () => {
  registerTestTemplates(registry);
  await build({
    ...buildOptions,
    entryPoints: ['tests/fixtures/worker.ts'],
    outfile: '.dev/test-worker.js',
  });
  pool = new RenderPool(config, pathToFileURL(resolve('.dev/test-worker.js')));
  await pool.start();
  server = createServer(toNodeHandler(createApp(config, pool, registry)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  origin = 'http://127.0.0.1:' + (typeof address === 'object' && address ? address.port : 0);
});
afterAll(async () => {
  await pool?.close();
  server?.closeAllConnections();
  await new Promise<void>(resolve => server?.close(() => resolve()));
});

describe('HTTP end-to-end', () => {
  it('does not feed transformed HTTP data back through the renderer schema', async () => {
    const seen: string[] = [];
    const templates = new TemplateRegistry().register({
      id: 'transform',
      name: 'Transform fixture',
      description: 'Non-idempotent data normalization',
      schema: z.object({ text: z.string().overwrite(text => text + '!') }),
      sizing: { mode: 'auto-height', width: 300 },
      mock: { text: 'Hello' },
      render: data => {
        seen.push(data.text);
        return createElement('div', { style: { display: 'flex' } }, data.text);
      },
    });
    const renderer = new Renderer(config, await loadFonts(config.fontConfig), templates);
    const app = createApp(
      config,
      {
        healthy: true,
        stats: { workers: 1, active: 0, queued: 0 },
        render: request => renderer.render(request),
      },
      templates,
    );
    const response = await app.fetch(
      new Request('http://localhost/v1/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'transform', data: { text: 'Hello' }, format: 'svg' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<svg');
    expect(seen).toEqual(['Hello!']);
  });

  it('uses the supplied empty catalog without leaking production templates', async () => {
    const app = createApp(config, pool, new TemplateRegistry());
    const response = await app.fetch(new Request('http://localhost/v1/templates'));
    expect(await response.json()).toEqual({ templates: [] });
    const missing = await app.fetch(new Request('http://localhost/v1/templates/example'));
    expect(missing.status).toBe(404);
  });
  it('serves the homepage even when the Playground is disabled', async () => {
    const response = await fetch(origin + '/');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    const html = await response.text();
    expect(html).toContain('href="/dev"');
    expect(html).toContain('当前实例未开放 Playground');
  });
  it.each(['/missing', '/dev/', '/dev/missing'])('serves a browser 404 at %s', async path => {
    const response = await fetch(origin + path, { headers: { Accept: 'text/html' } });
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('Vary')).toBe('Accept');
    expect(await response.text()).toContain('href="/"');
    const head = await fetch(origin + path, { method: 'HEAD', headers: { Accept: 'text/html' } });
    expect(head.status).toBe(404);
    expect(await head.text()).toBe('');
  });
  it('keeps API, non-browser and non-GET errors in JSON', async () => {
    for (const [path, method, accept] of [
      ['/v1/missing', 'GET', 'text/html'],
      ['/v1/templates/missing', 'GET', 'text/html'],
      ['/missing', 'GET', 'application/json'],
      ['/missing', 'GET', '*/*'],
      ['/missing', 'POST', 'text/html'],
    ]) {
      const response = await fetch(origin + path, { method, headers: { Accept: accept! } });
      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect((await response.json()).error.code).toMatch(/NOT_FOUND/);
    }
  });
  it('redirects /dev once and serves /dev/ when the production Playground is enabled', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'forma-playground-'));
    const html = '<!doctype html><html><body>Playground</body></html>';
    try {
      await writeFile(resolve(directory, 'index.html'), html);
      const app = createApp({ ...config, playground: true }, pool, registry, directory);
      const redirect = await app.fetch(new Request('http://localhost/dev'));
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get('Location')).toBe('/dev/');
      const response = await app.fetch(new Request('http://localhost/dev/'));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(html);
      const homepage = await app.fetch(new Request('http://localhost/'));
      expect(await homepage.text()).not.toContain('当前实例未开放 Playground');
      for (const path of ['/dev/missing', '/dev/assets/missing.js']) {
        const missing = await app.fetch(new Request('http://localhost' + path, { headers: { Accept: 'text/html' } }));
        expect(missing.status).toBe(404);
        expect(missing.headers.get('Content-Type')).toContain('text/html');
        expect(await missing.text()).toContain('href="/dev"');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('serves health, metadata, JSON Schema and mock data', async () => {
    expect((await fetch(origin + '/healthz')).status).toBe(200);
    const list = await (await fetch(origin + '/v1/templates')).json();
    expect(list.templates.map((t: { id: string }) => t.id)).toEqual([
      'example',
      'social_post',
      'comparison',
      'article',
      'bilibili',
      'youtube',
      'test-content',
      'test-auto-height',
    ]);
    const metadata = await (await fetch(origin + '/v1/templates/test-content')).json();
    expect(metadata.schema.required).toContain('title');
    expect(metadata.schema.properties).not.toHaveProperty('watermark');
    expect(metadata.mock).not.toHaveProperty('watermark');
    expect(metadata).not.toHaveProperty('documentation');
    expect((await fetch(origin + '/dev/')).status).toBe(404);
  });
  it.each(['example', 'social_post', 'test-content'])(
    'returns JSON 404 for the removed plain text route for %s',
    async template => {
      const response = await fetch(origin + '/v1/templates/' + template + '.txt');
      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect((await response.json()).error.code).toBe('TEMPLATE_NOT_FOUND');
    },
  );
  it('saves and decodes actual PNG output from registered templates and renders SVG', async () => {
    await mkdir('artifacts', { recursive: true });
    for (const template of registry.list()) {
      const response = await post({
        template: template.id,
        data: template.mock,
        watermark: 'Generated by Forma',
        format: 'png',
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      const path = 'artifacts/' + template.id + '.png';
      await writeFile(path, Buffer.from(await response.arrayBuffer()));
      const png = PNG.sync.read(await readFile(path));
      expect(png.width).toBe(Number(response.headers.get('X-Image-Width')));
      expect(png.height).toBe(Number(response.headers.get('X-Image-Height')));
      expect(png.data.some(byte => byte > 0 && byte < 200)).toBe(true);
      const svgResponse = await post({
        template: template.id,
        data: template.mock,
        watermark: 'Generated by Forma',
        format: 'svg',
      });
      const svg = await svgResponse.text();
      expect(svgResponse.status).toBe(200);
      expect(svg).toMatch(/^<svg/);
      await writeFile('artifacts/' + template.id + '.svg', svg);
    }
  });
  it('always returns 2x PNG without a scale parameter', async () => {
    const response = await post({ template: 'test-auto-height', data: { title: 'Fixed output' }, format: 'png' });
    expect(response.status).toBe(200);
    const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    expect(png.width).toBe(1240);
    expect(png.height).toBe(Number(response.headers.get('X-Layout-Height')) * 2);
    expect(response.headers.get('X-Render-Scale')).toBe('2');
  });
  it('embeds HTTP and local file media in production templates through HTTP and workers', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'forma-media-'));
    const image = new PNG({ width: 64, height: 32 });
    for (let i = 0; i < image.data.length; i += 4) image.data.set([20, 180, 90, 255], i);
    const bytes = PNG.sync.write(image);
    const path = resolve(directory, '测试 image.png');
    await writeFile(path, bytes);
    const mediaServer = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'image/png' });
      response.end(bytes);
    });
    try {
      mediaServer.listen(0, '127.0.0.1');
      await once(mediaServer, 'listening');
      const address = mediaServer.address();
      if (!address || typeof address === 'string') throw new Error('Missing media server address');
      await mkdir('artifacts/media-sources', { recursive: true });
      for (const url of [pathToFileURL(path).href, 'http://127.0.0.1:' + address.port + '/image.png']) {
        const requests = [
          {
            template: 'social_post',
            data: {
              author: { name: '媒体测试', avatarUrl: url },
              content: '中文 日本語 English',
              media: [{ url }, { type: 'video', url, previewUrl: url }],
            },
          },
          {
            template: 'article',
            data: {
              author: '图片测试',
              authorAvatarUrl: url,
              content: '中文 日本語 English\n\n![本地或 HTTP 图片](' + url + ')',
            },
          },
          {
            template: 'comparison',
            data: { title: '图片对比', modules: [{ type: 'image', before: { url }, after: { url } }] },
          },
        ];
        for (const request of requests) {
          for (const format of ['png', 'svg']) {
            const response = await post({ ...request, format });
            expect(response.status).toBe(200);
            expect(response.headers.get('X-Render-Warnings')).toBe('');
            const body = Buffer.from(await response.arrayBuffer());
            if (format === 'svg') {
              expect(body.toString()).toContain('data:image/png;base64,' + bytes.toString('base64'));
              expect(body.toString()).not.toContain(url);
            } else {
              const decoded = PNG.sync.read(body);
              expect(decoded.width).toBe(Number(response.headers.get('X-Image-Width')));
              expect(decoded.height).toBe(Number(response.headers.get('X-Image-Height')));
              let greenPixels = 0;
              for (let i = 0; i < decoded.data.length; i += 4) {
                if (
                  Math.abs(decoded.data[i]! - 20) < 5 &&
                  Math.abs(decoded.data[i + 1]! - 180) < 5 &&
                  Math.abs(decoded.data[i + 2]! - 90) < 5
                )
                  greenPixels++;
              }
              expect(greenPixels).toBeGreaterThan(1000);
            }
            await writeFile(
              'artifacts/media-sources/' + request.template + '-' + new URL(url).protocol.slice(0, -1) + '.' + format,
              body,
            );
          }
        }
      }
      const missing = await post({
        template: 'social_post',
        data: { media: [{ url: pathToFileURL(path + '.missing').href }] },
        format: 'png',
      });
      expect(missing.status).toBe(200);
      expect(missing.headers.get('X-Render-Warnings')).toContain('IMAGE_UNAVAILABLE');
      await writeFile('artifacts/media-sources/missing.png', Buffer.from(await missing.arrayBuffer()));
    } finally {
      mediaServer.closeAllConnections();
      await new Promise<void>(resolve => mediaServer.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('renders uploaded images through real workers and isolates resource IDs', async () => {
    await mkdir('artifacts/uploads', { recursive: true });
    const make = async (color: string, format: 'png' | 'jpeg' | 'webp') =>
      sharp({ create: { width: 80, height: 40, channels: 3, background: color } })
        .toFormat(format)
        .toBuffer();
    const upload = (bytes: Uint8Array, format = 'svg', template = 'article') => {
      const body = new FormData();
      body.append('cover', new Blob([new Uint8Array(bytes)], { type: 'text/plain' }), 'untrusted.txt');
      body.append(
        'request',
        JSON.stringify({
          template,
          format,
          assetUrlPrefix: 'https://unused.invalid/',
          data:
            template === 'article'
              ? { title: '上传图片 中文 日本語', content: '![封面](asset:cover)\n\n![重复引用](asset:cover)' }
              : {
                  title: '上传对比',
                  modules: [{ type: 'image', before: { url: 'asset:cover' }, after: { url: 'asset:cover' } }],
                },
        }),
      );
      return fetch(origin + '/v1/render', { method: 'POST', body });
    };
    for (const type of ['png', 'jpeg', 'webp'] as const) {
      const bytes = await make('#14b45a', type);
      for (const format of ['png', 'svg']) {
        const response = await upload(bytes, format, type === 'jpeg' ? 'comparison' : 'article');
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Render-Warnings')).toBe('');
        const output = Buffer.from(await response.arrayBuffer());
        if (format === 'svg') {
          expect(output.toString()).toContain('data:image/');
          expect(output.toString()).not.toContain('asset:cover');
        } else {
          const decoded = PNG.sync.read(output);
          expect(decoded.width).toBe(Number(response.headers.get('X-Layout-Width')) * 2);
          let colored = 0;
          for (let i = 0; i < decoded.data.length; i += 4)
            if (Math.abs(decoded.data[i]! - 20) < 8 && Math.abs(decoded.data[i + 1]! - 180) < 8) colored++;
          expect(colored).toBeGreaterThan(1000);
        }
        await writeFile('artifacts/uploads/' + type + '.' + format, output);
      }
    }
    const colors = await Promise.all(['red', 'blue'].map(color => make(color, 'png')));
    const outputs = await Promise.all(colors.map(async bytes => (await upload(bytes)).text()));
    for (let i = 0; i < colors.length; i++) {
      expect(outputs[i]).toContain(colors[i]!.toString('base64'));
      expect(outputs[i]).not.toContain(colors[1 - i]!.toString('base64'));
    }
    const missing = await post({ template: 'article', data: { content: '![缺失](asset:cover)' }, format: 'svg' });
    expect(missing.status).toBe(200);
    expect(missing.headers.get('X-Render-Warnings')).toContain('IMAGE_UNAVAILABLE');
    for (const bytes of [Buffer.from('not an image'), (await make('red', 'png')).subarray(0, 40)]) {
      const invalid = await upload(bytes);
      expect(invalid.status).toBe(422);
      expect((await invalid.json()).error.code).toBe('INVALID_IMAGE');
    }
  });
  it('accepts long output beyond the former pixel limit', async () => {
    const response = await post({
      template: 'test-auto-height',
      data: { title: '长内容', body: '正文\n'.repeat(150) },
      format: 'png',
    });
    expect(response.status).toBe(200);
    const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    expect(png.width * png.height).toBeGreaterThan(8000000);
  });
  it.each([1, 2, 4])('rejects the removed scale option %s', async scale => {
    const response = await post({ template: 'example', data: { text: 'Test' }, scale });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
  });
  it.each(['test-content', 'test-auto-height'])('validates the %s watermark before rendering', async template => {
    const metadata = await (await fetch(origin + '/v1/templates/' + template)).json();
    expect(metadata.schema.properties).not.toHaveProperty('watermark');
    for (const watermark of [123, null, 'x'.repeat(161)]) {
      const response = await post({
        template,
        data: metadata.mock,
        watermark,
        format: 'png',
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details[0].path).toEqual(['watermark']);
    }
    for (const watermark of [undefined, 'Top-level watermark']) {
      const response = await post({
        template,
        data: { ...metadata.mock, watermark: 'Old location' },
        watermark,
        format: 'png',
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
    }
  });
  it.each(['png', 'svg'])('uses top-level watermark for %s and hides omitted or blank values', async format => {
    const request = {
      template: 'test-content',
      data: { title: '水印测试' },
      format,
    };
    const plain = await post(request);
    const plainBody = Buffer.from(await plain.arrayBuffer());
    for (const watermark of ['', ' \n\t ']) {
      const blank = await post({ ...request, watermark });
      expect(blank.status).toBe(200);
      expect(Buffer.from(await blank.arrayBuffer())).toEqual(plainBody);
    }
    const marked = await post({
      ...request,
      watermark: '由 MagiBot 生成 · 日本語 · English',
    });
    expect(marked.status).toBe(200);
    expect(Number(marked.headers.get('X-Layout-Height'))).toBeGreaterThan(Number(plain.headers.get('X-Layout-Height')));
    expect(Buffer.from(await marked.arrayBuffer())).not.toEqual(plainBody);
  });
  it('returns consistent actionable errors for malformed input and unknown templates', async () => {
    for (const [body, code, status] of [
      [{ template: 'test-content', data: {} }, 'VALIDATION_ERROR', 400],
      [{ template: 'test-content', data: { title: 'Hi', html: '<script/>' } }, 'VALIDATION_ERROR', 400],
      [{ template: 'unknown', data: {} }, 'TEMPLATE_NOT_FOUND', 404],
      [{ template: 'test-content', data: { title: 'Hi' }, format: 'jpeg' }, 'VALIDATION_ERROR', 400],
    ] as const) {
      const response = await post(body);
      expect(response.status).toBe(status);
      expect((await response.json()).error.code).toBe(code);
    }
    const malformed = await fetch(origin + '/v1/render', {
      method: 'POST',
      body: '{',
      headers: { 'Content-Type': 'application/json' },
    });
    expect((await malformed.json()).error.code).toBe('INVALID_JSON');
    const tooLarge = await post({
      template: 'test-content',
      data: { title: 'x'.repeat(config.bodyLimit) },
    });
    expect(tooLarge.status).toBe(413);
    expect((await tooLarge.json()).error.code).toBe('BODY_LIMIT');
  });
  it('enforces body size without Content-Length and times out a stalled stream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('12345'));
        controller.close();
      },
    });
    const req = new Request('http://test', {
      method: 'POST',
      body: stream,
      headers: { 'Content-Type': 'application/json' },
      duplex: 'half',
    } as RequestInit);
    await expect(readJson(req, 3, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: 'BODY_LIMIT' });
    const stalled = new Request('http://test', {
      method: 'POST',
      body: new ReadableStream(),
      headers: { 'Content-Type': 'application/json' },
      duplex: 'half',
    } as RequestInit);
    await expect(readJson(stalled, 100, AbortSignal.timeout(20))).rejects.toMatchObject({ code: 'RENDER_TIMEOUT' });
  });
});
