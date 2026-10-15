import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { PNG } from 'pngjs';
import { Canvas, Image } from 'skia-canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { encodePng } from '../src/core/png.js';
import { rasterize } from '../src/core/rasterize.js';
import { svgForSkia } from '../src/core/svg-for-skia.js';
import { expectRasterGeometry } from './fixtures/raster-geometry.js';

const config = loadConfig({ LOG_LEVEL: 'silent' });
const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="80">${body}</svg>`;
const uri = (svg: string, base64 = true) =>
  'data:image/svg+xml;' +
  (base64 ? 'base64,' + Buffer.from(svg).toString('base64') : 'utf8,' + encodeURIComponent(svg));
const embed = (svg: string, attrs = '', base64 = true) =>
  `<image x="10" y="20" width="60" height="40" ${attrs} href="${uri(svg, base64)}"/>`;
// Frozen pre-migration pixels: independent of the adapter and current engine.
const baseline = (svg: string) => {
  const { data } = PNG.sync.read(
    readFileSync(
      new URL('./fixtures/svg-baselines/' + createHash('sha256').update(svg).digest('hex') + '.png', import.meta.url),
    ),
  );
  // PNG stores straight alpha; compare against the native premultiplied RGBA export.
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) data[i + c] = Math.round((data[i + c]! * data[i + 3]!) / 255);
  return data;
};
const pixels = async (svg: string) => (await rasterize(svg, 100, 80, config)).pixels;
const at = (data: Uint8Array, x: number, y: number, width = 100) =>
  Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));
afterEach(() => vi.restoreAllMocks());

describe('PNG-only structured SVG adaptation', () => {
  it.each([true, false])(
    'maps nonzero viewBox origin, intrinsic size and outer aspect independently (base64 %s)',
    async base64 => {
      const inner =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="10 20 20 10"><rect x="10" y="20" width="20" height="10" fill="red"/></svg>';
      for (const aspect of ['none', 'xMidYMid meet', 'xMaxYMin slice']) {
        const svg = wrap(embed(inner, `preserveAspectRatio="${aspect}"`, base64));
        expectRasterGeometry(await pixels(svg), baseline(svg), 100);
      }
    },
  );
  it('isolates inherited paint and IDs, preserving clip/mask/gradient references', async () => {
    const inner =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><linearGradient id="paint"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><clipPath id="clip"><rect width="10" height="20"/></clipPath><mask id="mask" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20"><rect width="20" height="20" fill="white"/></mask></defs><rect width="20" height="20" fill="url(#paint)" clip-path="url(#clip)" mask="url(#mask)"/></svg>';
    const svg = wrap(
      `<defs><path id="forma-inline-0" d="M0 0"/></defs><g fill="green" transform="translate(2 3)">${embed(inner)}${embed(inner)}</g>`,
    );
    const adapted = svgForSkia(svg, config);
    const doc = new DOMParser().parseFromString(adapted.toString(), 'image/svg+xml');
    const ids = Array.from(doc.getElementsByTagName('*'))
      .filter(n => n.hasAttribute('id'))
      .map(n => n.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);
    expectRasterGeometry(await pixels(svg), baseline(svg), 100);
    const skia = await rasterize(svg, 100, 80, config);
    expect(at(skia.pixels, 35, 40)[3]).toBe(255);
    expect(at(skia.pixels, 60, 40)[3]).toBe(0);
    const plain = wrap(
      `<g fill="green">${embed('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20"/></svg>')}</g>`,
    );
    expect(at((await rasterize(plain, 100, 80, config)).pixels, 30, 40)).toEqual([0, 0, 0, 255]);
  });
  it('normalizes both image href namespaces and uses SVG2 href precedence', async () => {
    const png = new PNG({ width: 1, height: 1 });
    png.data.set([255, 0, 0, 255]);
    const data = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
    for (const attrs of [`href="${data}"`, `xlink:href="${data}"`, `href="${data}" xlink:href="file:///ignored.png"`]) {
      const svg = wrap(`<image width="100" height="80" ${attrs}/>`);
      const adapted = svgForSkia(svg, config).toString();
      expect(adapted).toContain('xlink:href="data:image/png');
      expect(adapted).not.toContain('file:');
      expect(at((await rasterize(svg, 100, 80, config)).pixels, 50, 40)).toEqual([255, 0, 0, 255]);
    }
  });
  it.each([
    '<image href="https://example.com/a.png"/>',
    '<image href="file:///tmp/a.png"/>',
    '<style>@import "https://example.com";</style>',
    '<script/>',
    '<use href="#a"/>',
    '<rect fill="url(https://example.com/a.svg#x)"/>',
    '<rect fill="url(#missing)"/>',
    '<rect id="x"/><rect id="x"/>',
    '<g onclick="x"/>',
    '<defs><linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/></defs>',
    '<clipPath id="a" clipPathUnits="objectBoundingBox"><rect width="1" height="1"/></clipPath>',
    '<rect fill="URL(https://example.com/image)"/>',
    '<rect style="fill:red"/>',
    '<image href="data:image/svg+xml;base64,!!!!"/>',
  ])('rejects unsupported or external content before native decoding: %s', body => {
    expect(() => svgForSkia(wrap(body), config)).toThrow();
  });
  it('rejects malformed XML, DTD, deep trees, byte/pixel excess and nested image documents', () => {
    expect(() => svgForSkia('<svg>', config)).toThrow();
    expect(() => svgForSkia('<?xml-stylesheet href="file:///tmp/style.css"?>' + wrap(''), config)).toThrow();
    expect(() => svgForSkia('<!DOCTYPE svg SYSTEM "file:///tmp/secret">' + wrap(''), config)).toThrow();
    expect(() => svgForSkia(wrap('<g>'.repeat(66) + '</g>'.repeat(66)), config)).toThrow();
    expect(() => svgForSkia(wrap(''), { ...config, maxOutputBytes: 1 })).toThrow();
    expect(() => svgForSkia(wrap(embed(wrap('<image href="file:///tmp/secret"/>'))), config)).toThrow();
    const png = new PNG({ width: 2, height: 2 });
    const svg = wrap(`<image href="data:image/png;base64,${PNG.sync.write(png).toString('base64')}"/>`);
    expect(() => svgForSkia(svg, { ...config, imageMaxPixels: 1 })).toThrow();
  });
  it('does not double-clip the fractional antialiased edge of an embedded image', async () => {
    const inner =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="red"/></svg>';
    const svg = wrap(`<image x="10.3" y="20.3" width="19.5" height="19.5" href="${uri(inner)}"/>`);
    const actual = await pixels(svg);
    expectRasterGeometry(actual, baseline(svg), 100);
    // An equivalent direct rectangle must have exactly the same edge coverage.
    // This catches an extra viewport clip without conflating engine AA differences.
    expect(actual).toEqual(await pixels(wrap('<rect x="10.3" y="20.3" width="19.5" height="19.5" fill="red"/>')));
  });
});

describe('Skia CPU raster lifetime and pixels', () => {
  it.each([1, 2, 3, 4])('exports RGBA with one premultiplication at scale %i', async scale => {
    const svg = wrap(
      '<rect x="10" y="10" width="20" height="20" fill="#ff2850" opacity="0.3"/><rect x="40" y="10" width="20" height="20" fill="#28b4ff" opacity="0.7"/>',
    );
    const raster = await rasterize(svg, 100 * scale, 80 * scale, config);
    const raw = at(raster.pixels, 20 * scale, 20 * scale, raster.width);
    expect(raw[0]).toBe(raw[3]);
    expect(raw[1]).toBeLessThan(15);
    expect(raw[2]).toBeLessThan(30);
    const png = PNG.sync.read(await encodePng(raster));
    const color = at(png.data, 20 * scale, 20 * scale, png.width);
    expect(color[0]).toBeGreaterThan(250);
    expect(color[1]).toBeGreaterThan(35);
    expect(color[2]).toBeGreaterThan(75);
    expect(color[3]).toBeGreaterThan(70);
    expect(color[3]).toBeLessThan(80);
    const blue = at(png.data, 50 * scale, 20 * scale, png.width);
    expect(blue[0]).toBeLessThan(45);
    expect(blue[1]).toBeGreaterThan(175);
    expect(blue[2]).toBeGreaterThan(250);
    expect(blue[3]).toBeGreaterThan(175);
    expect(at(png.data, 0, 0, png.width)[3]).toBe(0);
  });
  it('disposes image and canvas on decode, draw, readback failure and success', async () => {
    for (const stage of ['decode', 'draw', 'readback', 'success']) {
      vi.restoreAllMocks();
      const canvas = vi.spyOn(Canvas.prototype, 'dispose');
      const image = vi.spyOn(Image.prototype, 'dispose');
      if (stage === 'decode') vi.spyOn(Image.prototype, 'decode').mockRejectedValueOnce(new Error('decode'));
      if (stage === 'draw')
        vi.spyOn(Canvas.prototype, 'getContext').mockImplementationOnce(() => {
          throw new Error('draw');
        });
      if (stage === 'readback')
        vi.spyOn(Canvas.prototype, 'toBufferSync').mockImplementationOnce(() => {
          throw new Error('readback');
        });
      const job = rasterize(wrap('<rect width="10" height="10"/>'), 100, 80, config);
      if (stage === 'success') await job;
      else await expect(job).rejects.toThrow(stage);
      expect(canvas).toHaveBeenCalledTimes(1);
      expect(image).toHaveBeenCalledTimes(1);
    }
  });
  it('checks dimensions before any canvas allocation or SVG decode', async () => {
    const decode = vi.spyOn(Image.prototype, 'decode');
    const context = vi.spyOn(Canvas.prototype, 'getContext');
    await expect(rasterize('not SVG', 4000, 4000, config)).rejects.toMatchObject({ code: 'SIZE_LIMIT' });
    expect(decode).not.toHaveBeenCalled();
    expect(context).not.toHaveBeenCalled();
  });
});
