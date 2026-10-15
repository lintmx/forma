import { Canvas, Image } from 'skia-canvas';
import type { Config } from '../config.js';
import type { Raster } from './png.js';
import { assertDimensions } from './sizing.js';
import { svgForSkia } from './svg-for-skia.js';

export async function rasterize(svg: string, width: number, height: number, config: Config): Promise<Raster> {
  assertDimensions(width, height, config);
  const adapted = svgForSkia(svg, config);
  const canvas = new Canvas(width, height, { gpu: false });
  let image: Image | undefined;
  try {
    // Retain the handle before decoding so failure also releases native state.
    image = new Image();
    image.src = adapted;
    await image.decode();
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    // Async Skia exports can settle a native Promise after Worker termination
    // (fatal in Skia 4.0.0 / Neon). Keep raster work synchronous inside the Worker.
    const pixels = canvas.toBufferSync('raw', { colorType: 'rgba', premultiplied: true });
    if (pixels.length !== width * height * 4) throw new Error('Unexpected Skia raster dimensions');
    return { pixels, width, height };
  } finally {
    canvas.dispose();
    image?.dispose();
  }
}
