import sharp from 'sharp';
import type { Raster } from '../../src/core/png.js';

export function rasterPng(raster: Raster) {
  return sharp(raster.pixels, {
    raw: { width: raster.width, height: raster.height, channels: 4, premultiplied: true },
  })
    .png()
    .toBuffer();
}
