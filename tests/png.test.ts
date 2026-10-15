import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { encodePng } from '../src/core/png.js';
import { rasterize } from '../src/core/rasterize.js';
import { expectPngQuality } from './fixtures/png-quality.js';
import { rasterPng } from './fixtures/raster-png.js';

describe('PNG encoding', () => {
  it('preserves resolution, transparency and the colors of premultiplied Skia pixels', async () => {
    const raster = await rasterize(
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64">
      <rect x="8" y="8" width="48" height="48" fill="#ff2850" opacity="0.3"/>
      <rect x="72" y="8" width="48" height="48" fill="#28b4ff" opacity="0.7"/>
    </svg>`,
      256,
      128,
      loadConfig({ LOG_LEVEL: 'silent' }),
    );
    const reference = PNG.sync.read(await rasterPng(raster));
    const actual = PNG.sync.read(await encodePng(raster));
    expect([actual.width, actual.height]).toEqual([256, 128]);
    expect(actual.data[3]).toBe(0);
    expect(actual.data[(32 * actual.width + 32) * 4 + 3]).toBeGreaterThan(0);
    expect(actual.data[(32 * actual.width + 32) * 4 + 3]).toBeLessThan(255);
    expectPngQuality(actual.data, reference.data);
  });
});
