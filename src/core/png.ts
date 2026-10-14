import type { RenderedImage } from '@resvg/resvg-js';
import sharp from 'sharp';

export async function encodePng(raster: RenderedImage): Promise<Buffer> {
  return sharp(raster.pixels, {
    raw: {
      width: raster.width,
      height: raster.height,
      channels: 4,
      // resvg already premultiplies RGB by alpha; doing it twice darkens edges.
      premultiplied: true,
    },
  })
    .png({
      compressionLevel: 7,
      palette: true,
      quality: 85,
      effort: 3,
      dither: 0.5,
      adaptiveFiltering: false,
    })
    .toBuffer();
}
