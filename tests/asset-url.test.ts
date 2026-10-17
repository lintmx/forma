import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { assetUrlSchema, resolveAssetUrl } from '../src/core/asset-url.js';
import { ImageStore } from '../src/core/images.js';
import { renderOptionsSchema, renderRequestSchema } from '../src/core/request.js';
import { createTemplateRegistry } from '../src/templates/index.js';

const prefix = 'http://localhost:8000/static/';
const request = { template: 'example', data: { text: 'test' } };

describe('asset URL prefix contract', () => {
  it.each([
    ['images/a.png', prefix + 'images/a.png'],
    ['/images/a.png', prefix + 'images/a.png'],
    ['./images/a.png', prefix + 'images/a.png'],
    ['images/a.png?v=2#preview', prefix + 'images/a.png?v=2#preview'],
    ['图片/a%20b.png', prefix + '%E5%9B%BE%E7%89%87/a%20b.png'],
    ['https://cdn.example.com/a.png', 'https://cdn.example.com/a.png'],
    ['file:///tmp/a.png', 'file:///tmp/a.png'],
    ['//cdn.example.com/a.png', 'http://cdn.example.com/a.png'],
    ['ftp://example.com/a.png', 'ftp://example.com/a.png'],
    ['', ''],
  ])('resolves %s without rewriting complete URLs', (input, expected) => {
    expect(resolveAssetUrl(input, prefix)).toBe(expected);
    expect(resolveAssetUrl(input, prefix.slice(0, -1))).toBe(expected);
    expect(resolveAssetUrl(input)).toBe(input);
    expect(resolveAssetUrl(input, '')).toBe(input);
  });

  it('normalizes the optional prefix and rejects invalid top-level options', () => {
    expect(renderRequestSchema.parse(request).assetUrlPrefix).toBeUndefined();
    expect(renderRequestSchema.parse({ ...request, assetUrlPrefix: '  ' }).assetUrlPrefix).toBe('');
    expect(
      renderRequestSchema.parse({ ...request, assetUrlPrefix: '  http://localhost:8000/static  ' }).assetUrlPrefix,
    ).toBe(prefix);
    expect(resolveAssetUrl('//cdn.example.com/a.png', 'https://example.com/')).toBe('https://cdn.example.com/a.png');
    for (const assetUrlPrefix of [
      'static/',
      '//host/',
      'file:///tmp/',
      'ftp://host/',
      'http:host',
      'https://',
      'https://host/?v=1',
      'https://host/#preview',
      'https://host/?',
      'https://host/#',
      123,
      null,
    ]) {
      expect(renderRequestSchema.safeParse({ ...request, assetUrlPrefix }).success, String(assetUrlPrefix)).toBe(false);
    }
  });

  it('keeps normalized prefixes valid when the worker validates them again at the length boundary', () => {
    const base = 'http://localhost/';
    const maxWithoutSlash = base + 'a'.repeat(2048 - base.length);
    expect(renderRequestSchema.safeParse({ ...request, assetUrlPrefix: maxWithoutSlash }).success).toBe(false);
    for (const assetUrlPrefix of [maxWithoutSlash.slice(0, -1), maxWithoutSlash.slice(0, -1) + '/']) {
      const parsed = renderRequestSchema.parse({ ...request, assetUrlPrefix });
      expect(parsed.assetUrlPrefix).toHaveLength(2048);
      expect(renderOptionsSchema.parse(parsed).assetUrlPrefix).toBe(parsed.assetUrlPrefix);
      expect(renderRequestSchema.parse(parsed)).toEqual(parsed);
    }
  });

  it('accepts resource paths but preserves protocol, length and empty-value constraints', () => {
    for (const value of [
      'a.png',
      '/a.png',
      './a.png',
      '//cdn.example.com/a.png',
      '图片.png',
      'https://host/a',
      'file:///tmp/a',
    ]) {
      expect(assetUrlSchema.safeParse(value).success, value).toBe(true);
    }
    for (const value of [
      '',
      ' ',
      'a'.repeat(2049),
      'ftp://host/a',
      'data:image/png;base64,a',
      'javascript:alert(1)',
      'C:\\a.png',
      '?v=1',
      '#a',
    ]) {
      expect(assetUrlSchema.safeParse(value).success, value).toBe(false);
    }
    const registry = createTemplateRegistry();
    expect(() => registry.validate('article', { content: 'x', authorAvatarUrl: '' })).not.toThrow();
    expect(() => registry.validate('social_post', { author: { avatarUrl: '' } })).toThrow();
    expect(() => registry.validate('social_post', { media: [{ url: '' }] })).toThrow();
    expect(() => registry.validate('article', { content: 'x', assetUrlPrefix: prefix })).toThrow();
    expect(() =>
      registry.register({
        ...registry.get('example'),
        id: 'reserved',
        schema: renderRequestSchema.pick({ assetUrlPrefix: true }),
        mock: {},
      }),
    ).toThrow('reserved');
    expect(() => registry.list()).not.toThrow();
  });

  it('isolates concurrent prefixes while sharing cache and inflight downloads by resolved URL', async () => {
    const config = loadConfig({});
    const red = new PNG({ width: 1, height: 1 });
    red.data.set([255, 0, 0, 255]);
    const blue = new PNG({ width: 1, height: 1 });
    blue.data.set([0, 0, 255, 255]);
    const download = vi.fn(async (url: string) => PNG.sync.write(url.includes('/red/') ? red : blue));
    const store = new ImageStore(config, download);
    const first = store.withPrefix('https://host/red/');
    const second = store.withPrefix('https://host/blue/');
    const [a, b, same, absolute] = await Promise.all([
      first.get('image.png'),
      second.get('image.png'),
      first.get('/image.png'),
      store.get('https://host/red/image.png'),
    ]);
    expect(a).not.toBe(b);
    expect(a).toBe(same);
    expect(a).toBe(absolute);
    expect(await first.get('image.png')).toBe(a);
    expect(download.mock.calls.map(([url]) => url)).toEqual([
      'https://host/red/image.png',
      'https://host/blue/image.png',
    ]);
    await expect(new ImageStore(config).withPrefix().get('image.png')).rejects.toThrow();
  });
});
