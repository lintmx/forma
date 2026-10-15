import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { getRouterParam, H3, type H3Event } from 'h3';
import type { Config } from '../config.js';
import { log } from '../config.js';
import { FormaError, publicError } from '../core/errors.js';
import type { RenderPool } from '../core/pool.js';
import type { TemplateRegistry } from '../core/registry.js';
import { renderRequestSchema } from '../core/request.js';
import { pageResponse } from './pages.js';

export async function readJson(request: Request, maxBytes: number, signal: AbortSignal) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
    throw new FormaError('CONTENT_TYPE', 'Use application/json', 415);
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes)
    throw new FormaError('BODY_LIMIT', 'Request body is too large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new FormaError('INVALID_JSON', 'JSON body is required', 400);
  const abort = () => {
    void reader.cancel();
  };
  signal.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new FormaError('RENDER_TIMEOUT', 'Request deadline exceeded', 504);
      const { done, value } = await reader.read();
      if (signal.aborted) throw new FormaError('RENDER_TIMEOUT', 'Request deadline exceeded', 504);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel();
        throw new FormaError('BODY_LIMIT', 'Request body is too large', 413);
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new FormaError('INVALID_JSON', 'Malformed JSON', 400);
  }
}

export function createApp(
  config: Config,
  pool: Pick<RenderPool, 'healthy' | 'stats' | 'render'>,
  registry: TemplateRegistry,
  playgroundDirectory = resolve('dist/playground'),
) {
  function errorResponse(error: unknown, event?: H3Event) {
    const e = publicError(error);
    if (
      e.status === 404 &&
      event &&
      ['GET', 'HEAD'].includes(event.req.method) &&
      event.url.pathname !== '/v1' &&
      !event.url.pathname.startsWith('/v1/') &&
      event.req.headers.get('accept')?.includes('text/html')
    ) {
      return pageResponse('not-found', config.playground);
    }
    if (e.status === 500) log(config, 'error', 'Request failed', { error: String(error) });
    return Response.json(
      { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } },
      {
        status: e.status,
        headers: {
          'Cache-Control': 'no-store',
          ...(e.status === 404 ? { Vary: 'Accept' } : {}),
          ...(e.status === 503 ? { 'Retry-After': '1' } : {}),
        },
      },
    );
  }
  const handle = (handler: (event: H3Event) => unknown) => async (event: H3Event) => {
    try {
      return await handler(event);
    } catch (error) {
      return errorResponse(error, event);
    }
  };
  const app = new H3({ onError: (error, event) => errorResponse(error, event), silent: true });
  app.get('/', () => pageResponse('home', config.playground));
  app.get('/healthz', () =>
    Response.json({ status: pool.healthy ? 'ok' : 'unavailable', ...pool.stats }, { status: pool.healthy ? 200 : 503 }),
  );
  app.get('/v1/templates', () => ({ templates: registry.list() }));
  app.get(
    '/v1/templates/:template',
    handle(event => {
      const id = getRouterParam(event, 'template')!;
      return registry.metadata(id);
    }),
  );
  app.post(
    '/v1/render',
    handle(async event => {
      const start = Date.now();
      const signal = AbortSignal.any([event.req.signal, AbortSignal.timeout(config.timeoutMs)]);
      const parsed = renderRequestSchema.safeParse(await readJson(event.req, config.bodyLimit, signal));
      if (!parsed.success) throw new FormaError('VALIDATION_ERROR', 'Invalid render request', 400, parsed.error.issues);
      const request = parsed.data;
      // Reject invalid data before queueing, but send original input to the worker.
      // Feeding parsed output back through a schema can apply transformations twice.
      registry.validate(request.template, request.data);
      // The worker's deadline includes queue time and is shortened by body reading.
      // Use the original request signal here so deadline errors consistently use 504.
      const result = await pool.render(request, event.req.signal, config.timeoutMs - (Date.now() - start));
      log(config, 'info', 'Rendered card', {
        template: request.template,
        format: result.format,
        width: result.width,
        height: result.height,
        scale: result.scale,
        durationMs: Date.now() - start,
      });
      return new Response(new Uint8Array(result.body), {
        headers: {
          'Content-Type': result.format === 'png' ? 'image/png' : 'image/svg+xml; charset=utf-8',
          'Content-Length': String(result.body.byteLength),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
          'X-Image-Width': String(result.width),
          'X-Image-Height': String(result.height),
          'X-Layout-Width': String(result.layoutWidth),
          'X-Layout-Height': String(result.layoutHeight),
          'X-Render-Scale': String(result.scale),
          'X-Render-Warnings': result.warnings.join(','),
        },
      });
    }),
  );
  if (config.playground) {
    const servePlayground = handle(async (event: H3Event) => {
      const path = event.url.pathname.slice(4).replace(/^\//, '') || 'index.html';
      if (!/^(index\.html|favicon\.svg|assets\/[a-zA-Z0-9_.-]+\.(js|css))$/.test(path))
        throw new FormaError('NOT_FOUND', 'Not found', 404);
      const content = await readFile(resolve(playgroundDirectory, path)).catch(() => {
        throw new FormaError('NOT_FOUND', 'Build the Playground first', 404);
      });
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
      }[extname(path)]!;
      return new Response(content, { headers: { 'Content-Type': mime } });
    });
    app.get('/dev', event =>
      event.url.pathname.endsWith('/')
        ? servePlayground(event)
        : new Response(null, { status: 302, headers: { Location: '/dev/' } }),
    );
    app.get('/dev/**', servePlayground);
  }
  app.all(
    '/**',
    handle(() => {
      throw new FormaError('NOT_FOUND', 'Route not found', 404);
    }),
  );
  return app;
}
