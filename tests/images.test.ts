import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { downloadImage, ImageStore, imageDataUri } from '../src/core/images.js';
import { rasterize } from '../src/core/rasterize.js';

const config = loadConfig({});
const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
let directory: string;
let fileUrl: string;
let origin: string;
let server: Server;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'forma-images-'));
  const path = join(directory, '图片 #1.png');
  await writeFile(path, png);
  fileUrl = pathToFileURL(path).href;
  server = createServer((request, response) => {
    if (request.url === '/redirect' || request.url === '/loop' || request.url === '/file') {
      response.writeHead(302, {
        Location: request.url === '/file' ? fileUrl : request.url === '/loop' ? '/loop' : '/image',
      });
    } else if (request.url === '/missing') {
      response.writeHead(404);
    } else if (request.url === '/slow') {
      return;
    } else if (request.url === '/auth' && request.headers.authorization !== 'Basic dXNlcjpwYXNz') {
      response.writeHead(401);
    } else {
      response.writeHead(200, { 'Content-Type': 'image/png' });
      response.write(png);
    }
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  origin = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => {
  server?.closeAllConnections();
  await new Promise<void>(resolve => server?.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
describe('bounded image resources', () => {
  it('loads loopback HTTP, redirects and credentials', async () => {
    for (const url of [
      origin + '/image',
      origin + '/redirect',
      origin.replace('http://', 'http://user:pass@') + '/auth',
    ]) {
      expect(await downloadImage(url, config)).toEqual(png);
    }
  });
  it('loads encoded local file URLs directly and via redirects', async () => {
    for (const url of [fileUrl, origin + '/file']) {
      expect(await new ImageStore(config).get(url)).toBe(imageDataUri(png, config));
    }
  });
  it('keeps byte limits, timeouts, redirect limits and load errors', async () => {
    for (const url of [fileUrl, origin + '/image']) {
      await expect(downloadImage(url, { ...config, imageMaxBytes: png.length - 1 })).rejects.toThrow('too large');
    }
    await expect(downloadImage(origin + '/slow', { ...config, imageTimeoutMs: 20 })).rejects.toThrow();
    await expect(downloadImage(origin + '/loop', config)).rejects.toThrow('Too many image redirects');
    await expect(downloadImage(origin + '/missing', config)).rejects.toThrow();
    await expect(downloadImage(fileUrl + '.missing', config)).rejects.toThrow();
    await expect(downloadImage('ftp://example.com/image.png', config)).rejects.toThrow('Only HTTP(S) and file');
    const invalid = pathToFileURL(join(directory, 'invalid.png'));
    await writeFile(invalid, 'not an image');
    await expect(new ImageStore(config).get(invalid.href)).rejects.toThrow();
  });
  it('rejects SVG, excessive encoded bytes and decoded pixel counts', () => {
    expect(() => imageDataUri(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), config)).toThrow();
    expect(() => imageDataUri(png, { ...config, imageMaxBytes: 1 })).toThrow();
    expect(() => imageDataUri(png, { ...config, imageMaxPixels: 1 })).toThrow();
    expect(imageDataUri(png, config)).toMatch(/^data:image\/png;base64,/);
  });
  it('normalizes WebP into renderable PNG, preserving pixels and enforcing input and output limits', async () => {
    const webp = await sharp({
      create: { width: 4, height: 2, channels: 4, background: { r: 30, g: 100, b: 200, alpha: 1 } },
    })
      .webp({ lossless: true })
      .toBuffer();
    const download = vi.fn(async () => webp);
    const store = new ImageStore(config, download);
    const data = await store.get('webp');
    expect(data).toMatch(/^data:image\/png;base64,/);
    const decoded = PNG.sync.read(Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
    expect([decoded.width, decoded.height]).toEqual([4, 2]);
    expect([...decoded.data.subarray(0, 4)]).toEqual([30, 100, 200, 255]);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"><image href="' +
      data +
      '" width="4" height="2" /></svg>';
    expect((await rasterize(svg, 4, 2, config)).pixels).toEqual(decoded.data);
    expect(await store.get('webp')).toBe(data);
    expect(download).toHaveBeenCalledTimes(1);
    await expect(new ImageStore({ ...config, imageMaxPixels: 1 }, download).get('webp')).rejects.toThrow(
      'excessive decoded dimensions',
    );
    await expect(new ImageStore({ ...config, imageMaxBytes: webp.length - 1 }, download).get('webp')).rejects.toThrow(
      'too large',
    );
    expect(Buffer.byteLength(data)).toBeGreaterThan(webp.length);
    await expect(new ImageStore({ ...config, imageMaxBytes: webp.length }, download).get('webp')).rejects.toThrow(
      'too large',
    );
  });
  it('deduplicates requests, caches successes, retries failures and expires entries', async () => {
    const download = vi.fn(async () => png);
    const store = new ImageStore({ ...config, imageCacheTtlMs: 10 }, download);
    await Promise.all([store.get('a'), store.get('a')]);
    await store.get('a');
    expect(download).toHaveBeenCalledTimes(1);
    await new Promise(resolve => setTimeout(resolve, 20));
    await store.get('a');
    expect(download).toHaveBeenCalledTimes(2);
    download.mockRejectedValueOnce(new Error('failed'));
    await expect(store.get('b')).rejects.toThrow('failed');
    await store.get('b');
    expect(download).toHaveBeenCalledTimes(4);
  });
  it('evicts least recently used entries within its byte budget', async () => {
    const download = vi.fn(async () => png);
    const store = new ImageStore(
      { ...config, imageCacheBytes: Buffer.byteLength(imageDataUri(png, config)) },
      download,
    );
    await store.get('a');
    await store.get('b');
    await store.get('a');
    expect(download).toHaveBeenCalledTimes(3);
  });
});
