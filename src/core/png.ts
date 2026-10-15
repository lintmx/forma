import sharp from 'sharp';

export interface Raster {
  pixels: Uint8Array;
  width: number;
  height: number;
}

export async function encodePng(raster: Raster, output?: { width: number; height: number }): Promise<Buffer> {
  const image = sharp(raster.pixels, {
    raw: {
      width: raster.width,
      height: raster.height,
      channels: 4,
      // The raster already premultiplies RGB by alpha; doing it twice darkens edges.
      premultiplied: true,
    },
  });
  if (output) image.resize(output.width, output.height, { kernel: 'lanczos3' });
  return image
    .png({
      compressionLevel: 5,
      palette: true,
      quality: 95,
      effort: 1,
      dither: 0.2,
      adaptiveFiltering: false,
    })
    .toBuffer();
}
