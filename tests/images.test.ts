import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { ImageStore, imageDataUri, isPublicAddress, resolvePublicUrl } from '../src/core/images.js';

const config = loadConfig({});
const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
describe('bounded image resources', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ])('blocks private/reserved address %s', address => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it('accepts public addresses and rejects disallowed URL schemes/credentials', async () => {
    expect(isPublicAddress('1.1.1.1')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    for (const url of [
      'file:///etc/passwd',
      'http://user:pass@example.com',
      'http://localhost/test',
      'http://[::1]/',
      'http://2130706433/',
    ]) {
      await expect(resolvePublicUrl(url)).rejects.toThrow();
    }
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
    expect(PNG.sync.read(new Resvg(svg).render().asPng()).data).toEqual(decoded.data);
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
