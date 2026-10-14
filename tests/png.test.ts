import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { encodePng } from '../src/core/png.js';
import { expectPngQuality } from './fixtures/png-quality.js';

describe('PNG encoding', () => {
  it('preserves resolution, transparency and the colors of premultiplied resvg pixels', async () => {
    const raster = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64">
      <rect x="8" y="8" width="48" height="48" fill="#ff2850" opacity="0.3"/>
      <rect x="72" y="8" width="48" height="48" fill="#28b4ff" opacity="0.7"/>
    </svg>`,
      { fitTo: { mode: 'zoom', value: 2 } },
    ).render();
    const reference = PNG.sync.read(raster.asPng());
    const actual = PNG.sync.read(await encodePng(raster));
    expect([actual.width, actual.height]).toEqual([256, 128]);
    expect(actual.data[3]).toBe(0);
    expect(actual.data[(32 * actual.width + 32) * 4 + 3]).toBeGreaterThan(0);
    expect(actual.data[(32 * actual.width + 32) * 4 + 3]).toBeLessThan(255);
    expectPngQuality(actual.data, reference.data);
  });
});
