import { resolve } from 'node:path';
import { z } from 'zod';

const integer = (fallback: number, max: number) => z.coerce.number().int().min(1).max(max).default(fallback);
const envSchema = z.object({
  PORT: integer(3000, 65535),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['silent', 'error', 'info', 'debug']).default('info'),
  RENDER_CONCURRENCY: integer(2, 8),
  RENDER_QUEUE_LIMIT: integer(16, 128),
  RENDER_TIMEOUT_MS: integer(15000, 120000),
  BODY_LIMIT_BYTES: integer(65536, 1048576),
  MAX_WIDTH: integer(4096, 4096),
  MAX_HEIGHT: integer(8192, 16384),
  MAX_PIXELS: integer(8000000, 16777216),
  MAX_OUTPUT_BYTES: integer(16777216, 67108864),
  IMAGE_TIMEOUT_MS: integer(4000, 30000),
  IMAGE_MAX_BYTES: integer(5242880, 20971520),
  IMAGE_MAX_PIXELS: integer(16000000, 64000000),
  IMAGE_CACHE_BYTES: integer(33554432, 268435456),
  IMAGE_CACHE_TTL_MS: integer(300000, 86400000),
  FONT_CONFIG: z.string().optional(),
  PLAYGROUND_ENABLED: z.enum(['true', 'false']).optional(),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const e = envSchema.parse(env);
  return {
    port: e.PORT, host: e.HOST, logLevel: e.LOG_LEVEL,
    concurrency: e.RENDER_CONCURRENCY, queueLimit: e.RENDER_QUEUE_LIMIT,
    timeoutMs: e.RENDER_TIMEOUT_MS, bodyLimit: e.BODY_LIMIT_BYTES,
    maxWidth: e.MAX_WIDTH, maxHeight: e.MAX_HEIGHT, maxPixels: e.MAX_PIXELS, maxOutputBytes: e.MAX_OUTPUT_BYTES,
    imageTimeoutMs: e.IMAGE_TIMEOUT_MS, imageMaxBytes: e.IMAGE_MAX_BYTES, imageMaxPixels: e.IMAGE_MAX_PIXELS,
    imageCacheBytes: e.IMAGE_CACHE_BYTES, imageCacheTtlMs: e.IMAGE_CACHE_TTL_MS,
    fontConfig: resolve(e.FONT_CONFIG ?? 'fonts/fonts.json'),
    playground: e.PLAYGROUND_ENABLED ? e.PLAYGROUND_ENABLED === 'true' : env.NODE_ENV !== 'production',
  };
}
export type Config = ReturnType<typeof loadConfig>;

export function log(config: Config, level: 'error' | 'info' | 'debug', message: string, fields: object = {}) {
  const levels = { silent: 0, error: 1, info: 2, debug: 3 };
  if (levels[config.logLevel] >= levels[level]) console.log(JSON.stringify({ time: new Date().toISOString(), level, message, ...fields }));
}
