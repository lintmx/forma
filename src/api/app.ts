import { H3, getRouterParam, type H3Event } from 'h3';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { z } from 'zod';
import type { Config } from '../config.js';
import { log } from '../config.js';
import { FormaError, publicError } from '../core/errors.js';
import { registry } from '../core/registry.js';
import type { RenderPool } from '../core/pool.js';
import { MAX_RENDER_SCALE } from '../core/types.js';
import { cardOptionsSchema } from '../core/card.js';

const requestSchema = z.object({
  template: z.string().min(1).max(64),
  data: z.unknown().refine(value => value !== undefined, 'data is required'),
  format: z.enum(['png', 'svg']).default('png'),
  scale: z.number().int().min(1).max(MAX_RENDER_SCALE).default(1),
  ...cardOptionsSchema.shape,
}).strict();

export async function readJson(request: Request, maxBytes: number, signal: AbortSignal) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new FormaError('CONTENT_TYPE', 'Use application/json', 415);
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw new FormaError('BODY_LIMIT', 'Request body is too large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new FormaError('INVALID_JSON', 'JSON body is required', 400);
  const abort = () => { void reader.cancel(); };
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
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new FormaError('INVALID_JSON', 'Malformed JSON', 400); }
}

export function createApp(config: Config, pool: RenderPool, playgroundDirectory = resolve('dist/playground')) {
  function errorResponse(error: unknown) {
    const e = publicError(error);
    if (e.status === 500) log(config, 'error', 'Request failed', { error: String(error) });
    return Response.json({ error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } }, { status: e.status, headers: { 'Cache-Control': 'no-store', ...(e.status === 503 ? { 'Retry-After': '1' } : {}) } });
  }
  const handle = (handler: (event: H3Event) => unknown) => async (event: H3Event) => {
    try { return await handler(event); } catch (error) { return errorResponse(error); }
  };
  const app = new H3({ onError: error => errorResponse(error), silent: true });
  app.get('/healthz', () => Response.json({ status: pool.healthy ? 'ok' : 'unavailable', ...pool.stats }, { status: pool.healthy ? 200 : 503 }));
  app.get('/v1/templates', () => ({ templates: registry.list() }));
  app.get('/v1/templates/:template', handle(event => {
    const id = getRouterParam(event, 'template')!;
    if (id.endsWith('.txt')) return new Response(registry.get(id.slice(0, -4)).documentation, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return registry.metadata(id);
  }));
  app.post('/v1/render', handle(async event => {
    const start = Date.now();
    const signal = AbortSignal.any([event.req.signal, AbortSignal.timeout(config.timeoutMs)]);
    const parsed = requestSchema.safeParse(await readJson(event.req, config.bodyLimit, signal));
    if (!parsed.success) throw new FormaError('VALIDATION_ERROR', 'Invalid render request', 400, parsed.error.issues);
    const request = { ...parsed.data, data: registry.validate(parsed.data.template, parsed.data.data) };
    // The worker's deadline includes queue time and is shortened by body reading.
    // Use the original request signal here so deadline errors consistently use 504.
    const result = await pool.render(request, event.req.signal, config.timeoutMs - (Date.now() - start));
    log(config, 'info', 'Rendered card', { template: request.template, format: result.format, width: result.width, height: result.height, scale: result.scale, durationMs: Date.now() - start });
    return new Response(new Uint8Array(result.body), { headers: {
      'Content-Type': result.format === 'png' ? 'image/png' : 'image/svg+xml; charset=utf-8',
      'Content-Length': String(result.body.byteLength), 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
      'X-Image-Width': String(result.width), 'X-Image-Height': String(result.height),
      'X-Layout-Width': String(result.layoutWidth), 'X-Layout-Height': String(result.layoutHeight),
      'X-Render-Scale': String(result.scale),
      'X-Render-Warnings': result.warnings.join(','),
    } });
  }));
  if (config.playground) {
    const servePlayground = handle(async (event: H3Event) => {
      const path = event.url.pathname.slice(4).replace(/^\//, '') || 'index.html';
      if (!/^(index\.html|assets\/[a-zA-Z0-9_.-]+\.(js|css))$/.test(path)) throw new FormaError('NOT_FOUND', 'Not found', 404);
      const content = await readFile(resolve(playgroundDirectory, path)).catch(() => { throw new FormaError('NOT_FOUND', 'Build the Playground first', 404); });
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[extname(path)]!;
      return new Response(content, { headers: { 'Content-Type': mime } });
    });
    app.get('/dev', event => event.url.pathname.endsWith('/')
      ? servePlayground(event)
      : new Response(null, { status: 302, headers: { Location: '/dev/' } }));
    app.get('/dev/**', servePlayground);
  }
  app.all('/**', handle(() => { throw new FormaError('NOT_FOUND', 'Route not found', 404); }));
  return app;
}
