import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { imageSize } from 'image-size';
import sharp from 'sharp';
import type { Config } from '../config.js';
import { FormaError } from './errors.js';

export function isPublicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch { return false; }
}

export async function resolvePublicUrl(input: string) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new FormaError('IMAGE_URL_BLOCKED', 'Only public HTTP(S) image URLs without credentials are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new FormaError('IMAGE_URL_BLOCKED', 'Private and reserved image destinations are blocked');
  }
  return { url, address: addresses[0]! };
}

// DNS is checked and the selected address is pinned into the actual connection.
// Every redirect repeats this validation; Satori only receives embedded data.
export async function downloadImage(input: string, config: Config): Promise<Buffer> {
  const signal = AbortSignal.timeout(config.imageTimeoutMs);
  const download = async (inputUrl: string, redirects: number): Promise<Buffer> => {
    const { url, address } = await resolvePublicUrl(inputUrl);
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        signal,
        headers: { Accept: 'image/png,image/jpeg,image/webp', 'User-Agent': 'forma/0.1' },
        lookup: (_host, _options, callback) => {
          // Node may request all addresses for autoSelectFamily.
          if (_options.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      }, response => {
        const status = response.statusCode ?? 500;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.destroy();
          if (!response.headers.location || redirects >= 3) return reject(new Error('Too many image redirects'));
          try { download(new URL(response.headers.location, url).href, redirects + 1).then(resolve, reject); }
          catch (error) { reject(error); }
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
          if (size > config.imageMaxBytes) request.destroy(new Error('Image is too large'));
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve(Buffer.concat(chunks)));
      });
      request.on('error', reject);
      request.end();
    });
  };
  // Also bound DNS resolution, which does not itself accept AbortSignal.
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Image download timed out'));
    signal.addEventListener('abort', abort, { once: true });
    download(input, 0).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function imageDataUri(buffer: Buffer, config: Config) {
  if (buffer.length > config.imageMaxBytes) throw new Error('Image is too large');
  const size = imageSize(buffer);
  if (!['png', 'jpg', 'webp'].includes(size.type ?? '') || !size.width || !size.height
    || size.width * size.height > config.imageMaxPixels || size.width > 16384 || size.height > 16384) {
    throw new Error('Unsupported image or excessive decoded dimensions');
  }
  return 'data:image/' + (size.type === 'jpg' ? 'jpeg' : size.type) + ';base64,' + buffer.toString('base64');
}

export class ImageStore {
  private cache = new Map<string, { data: string; expires: number; bytes: number }>();
  private inflight = new Map<string, Promise<string>>();
  private bytes = 0;
  constructor(private config: Config, private download = downloadImage) {}

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
    const promise = this.download(url, this.config).then(async buffer => {
      let data = imageDataUri(buffer, this.config);
      // resvg 2.6.2 cannot decode WebP; normalize only after validating input limits.
      if (data.startsWith('data:image/webp;')) {
        const png = await sharp(buffer, { limitInputPixels: this.config.imageMaxPixels, pages: 1 }).png().toBuffer();
        data = imageDataUri(png, this.config);
      }
      const bytes = Buffer.byteLength(data);
      if (bytes <= this.config.imageCacheBytes) {
        while (this.bytes + bytes > this.config.imageCacheBytes || this.cache.size >= 128) this.remove(this.cache.keys().next().value!);
        this.cache.set(url, { data, bytes, expires: Date.now() + this.config.imageCacheTtlMs });
        this.bytes += bytes;
      }
      return data;
    }).finally(() => this.inflight.delete(url));
    this.inflight.set(url, promise);
    return promise;
  }
  private remove(url: string) {
    const entry = this.cache.get(url);
    if (entry) this.bytes -= entry.bytes;
    this.cache.delete(url);
  }
}
