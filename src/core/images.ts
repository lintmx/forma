import { createReadStream } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { imageSize } from 'image-size';
import sharp from 'sharp';
import type { Config } from '../config.js';
import { resolveAssetUrl } from './asset-url.js';
import { FormaError } from './errors.js';

// HTTP(S) and local files share resource limits; Satori only receives embedded data.
export async function downloadImage(input: string, config: Config): Promise<Buffer> {
  const signal = AbortSignal.timeout(config.imageTimeoutMs);
  const download = async (inputUrl: string, redirects: number): Promise<Buffer> => {
    const url = new URL(inputUrl);
    signal.throwIfAborted();
    if (url.protocol === 'file:') {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of createReadStream(url, { signal })) {
        const buffer = chunk as Buffer;
        size += buffer.length;
        if (size > config.imageMaxBytes) throw new Error('Image is too large');
        chunks.push(buffer);
      }
      return Buffer.concat(chunks);
    }
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new FormaError('IMAGE_URL_BLOCKED', 'Only HTTP(S) and file image URLs are supported');
    }
    return new Promise((resolve, reject) => {
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        {
          signal,
          headers: { Accept: 'image/png,image/jpeg,image/webp', 'User-Agent': 'forma/0.1' },
        },
        response => {
          const status = response.statusCode ?? 500;
          if ([301, 302, 303, 307, 308].includes(status)) {
            response.destroy();
            if (!response.headers.location || redirects >= 3) return reject(new Error('Too many image redirects'));
            try {
              download(new URL(response.headers.location, url).href, redirects + 1).then(resolve, reject);
            } catch (error) {
              reject(error);
            }
            return;
          }
          if (status !== 200 || Number(response.headers['content-length'] ?? 0) > config.imageMaxBytes) {
            response.destroy();
            reject(new Error('Image response rejected'));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > config.imageMaxBytes) {
              const error = new Error('Image is too large');
              reject(error);
              request.destroy(error);
            } else chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => resolve(Buffer.concat(chunks)));
        },
      );
      request.on('error', reject);
      request.end();
    });
  };
  return download(input, 0);
}

export function imageDataUri(buffer: Buffer, config: Config) {
  if (buffer.length > config.imageMaxBytes) throw new Error('Image is too large');
  const size = imageSize(buffer);
  if (
    !['png', 'jpg', 'webp'].includes(size.type ?? '') ||
    !size.width ||
    !size.height ||
    size.width * size.height > config.imageMaxPixels ||
    size.width > 16384 ||
    size.height > 16384
  ) {
    throw new Error('Unsupported image or excessive decoded dimensions');
  }
  return 'data:image/' + (size.type === 'jpg' ? 'jpeg' : size.type) + ';base64,' + buffer.toString('base64');
}

export type ImageLoader = Pick<ImageStore, 'get'>;

export class ImageStore {
  private cache = new Map<string, { data: string; expires: number; bytes: number }>();
  private inflight = new Map<string, Promise<string>>();
  private bytes = 0;
  constructor(
    private config: Config,
    private download = downloadImage,
  ) {}

  withPrefix(prefix?: string): ImageLoader {
    return { get: async input => this.get(resolveAssetUrl(input, prefix)) };
  }

  async get(url: string): Promise<string> {
    const entry = this.cache.get(url);
    if (entry && entry.expires > Date.now()) {
      this.cache.delete(url);
      this.cache.set(url, entry);
      return entry.data;
    }
    if (entry) this.remove(url);
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const promise = this.download(url, this.config)
      .then(async buffer => {
        let data = imageDataUri(buffer, this.config);
        // Keep input normalization stable; convert WebP only after validating input limits.
        if (data.startsWith('data:image/webp;')) {
          const png = await sharp(buffer, { limitInputPixels: this.config.imageMaxPixels, pages: 1 }).png().toBuffer();
          data = imageDataUri(png, this.config);
        }
        const bytes = Buffer.byteLength(data);
        if (bytes <= this.config.imageCacheBytes) {
          while (this.bytes + bytes > this.config.imageCacheBytes || this.cache.size >= 128)
            this.remove(this.cache.keys().next().value!);
          this.cache.set(url, { data, bytes, expires: Date.now() + this.config.imageCacheTtlMs });
          this.bytes += bytes;
        }
        return data;
      })
      .finally(() => this.inflight.delete(url));
    this.inflight.set(url, promise);
    return promise;
  }
  private remove(url: string) {
    const entry = this.cache.get(url);
    if (entry) this.bytes -= entry.bytes;
    this.cache.delete(url);
  }
}
