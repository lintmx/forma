import { describe, expect, it, vi } from 'vitest';
import { PNG } from 'pngjs';
import { ImageStore, imageDataUri, isPublicAddress, resolvePublicUrl } from '../src/core/images.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig({});
const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
describe('bounded image resources', () => {
  it.each(['127.0.0.1', '10.1.2.3', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '2001:db8::1'])('blocks private/reserved address %s', address => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it('accepts public addresses and rejects disallowed URL schemes/credentials', async () => {
    expect(isPublicAddress('1.1.1.1')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    for (const url of ['file:///etc/passwd', 'http://user:pass@example.com', 'http://localhost/test', 'http://[::1]/', 'http://2130706433/']) {
      await expect(resolvePublicUrl(url)).rejects.toThrow();
    }
  });
  it('rejects SVG, excessive encoded bytes and decoded pixel counts', () => {
    expect(() => imageDataUri(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), config)).toThrow();
    expect(() => imageDataUri(png, { ...config, imageMaxBytes: 1 })).toThrow();
    expect(() => imageDataUri(png, { ...config, imageMaxPixels: 1 })).toThrow();
    expect(imageDataUri(png, config)).toMatch(/^data:image\/png;base64,/);
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
    const store = new ImageStore({ ...config, imageCacheBytes: Buffer.byteLength(imageDataUri(png, config)) }, download);
    await store.get('a'); await store.get('b'); await store.get('a');
    expect(download).toHaveBeenCalledTimes(3);
  });
});
