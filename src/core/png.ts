import sharp from 'sharp';

export interface Raster {
  pixels: Uint8Array;
  width: number;
  height: number;
}

export async function encodePng(raster: Raster): Promise<Buffer> {
  return sharp(raster.pixels, {
    raw: {
      width: raster.width,
      height: raster.height,
      channels: 4,
      // The raster already premultiplies RGB by alpha; doing it twice darkens edges.
      premultiplied: true,
    },
  })
    .png({
      compressionLevel: 5,
      palette: true,
      quality: 85,
      effort: 3,
      dither: 0.25,
      adaptiveFiltering: false,
    })
    .toBuffer();
}
