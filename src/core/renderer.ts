import satori, { type SatoriOptions } from 'satori';
import type { Config } from '../config.js';
import { registry } from '../templates/index.js';
import { CardFrame, cardOptionsSchema } from './card.js';
import { additionalAsset } from './emoji.js';
import { FormaError } from './errors.js';
import type { LoadedFonts } from './fonts.js';
import { ImageStore } from './images.js';
import { encodePng } from './png.js';
import { rasterize } from './rasterize.js';
import { assertDimensions, layoutOptions, svgDimensions } from './sizing.js';
import type { RenderRequest, RenderResult, TemplateContext } from './types.js';

export class Renderer {
  private images: ImageStore;
  constructor(
    private config: Config,
    private fonts: LoadedFonts,
  ) {
    this.images = new ImageStore(config);
  }
  async render(request: RenderRequest): Promise<RenderResult> {
    const options = cardOptionsSchema.safeParse(request);
    if (!options.success) throw new FormaError('VALIDATION_ERROR', 'Invalid render options', 400, options.error.issues);
    const { watermark } = options.data;
    // SVG stays vector-based at its logical size; only PNG is supersampled.
    const scale = request.format === 'png' ? 2 : 1;
    const template = registry.get(request.template);
    const data = registry.validate(request.template, request.data);
    const warnings: string[] = [];
    let assets: TemplateContext['assets'] = {};
    if (template.assets) {
      try {
        assets = await template.assets(data, this.images);
        if (Object.values(assets).some(asset => asset === undefined)) warnings.push('IMAGE_UNAVAILABLE');
      } catch {
        warnings.push('IMAGE_UNAVAILABLE');
      }
    }
    const context = {
      assets,
      fontFamily: this.fonts.fontFamily,
      monospaceFontFamily: this.fonts.monospaceFontFamily,
    };
    const base: Omit<SatoriOptions, 'width' | 'height'> = {
      fonts: this.fonts.fonts,
      embedFont: true,
      loadAdditionalAsset: additionalAsset,
      onStyleError: error => {
        throw error;
      },
    };
    const measure = template.measure
      ? CardFrame({
          children: template.measure(data, context),
          fontFamily: context.fontFamily,
          monospaceFontFamily: context.monospaceFontFamily,
        })
      : undefined;
    const dimensions = await layoutOptions(template.sizing, measure, base, this.config);
    const card = CardFrame({
      children: template.render(data, context),
      fontFamily: context.fontFamily,
      monospaceFontFamily: context.monospaceFontFamily,
      watermark,
      autoWidth: template.sizing.mode === 'auto-width',
    });
    const svg = await satori(card, { ...base, ...dimensions });
    const { width: layoutWidth, height: layoutHeight } = svgDimensions(svg);
    const width = layoutWidth * scale;
    const height = layoutHeight * scale;
    // Final output limits apply independently of the intermediate raster.
    assertDimensions(width, height, this.config);
    if (Buffer.byteLength(svg) > this.config.maxOutputBytes)
      throw new FormaError('OUTPUT_LIMIT', 'SVG exceeds output byte limit');
    let body: Buffer;
    if (request.format === 'svg') body = Buffer.from(svg);
    else {
      // The recommended 2x output gets 4x sampling before Lanczos downsampling.
      const factor = 2;
      const raster = await rasterize(svg, width * factor, height * factor, this.config, {
        maxWidth: this.config.maxWidth * factor,
        maxHeight: this.config.maxHeight * factor,
        maxPixels: this.config.maxRasterPixels,
      });
      body = await encodePng(raster, { width, height });
    }
    if (body.byteLength > this.config.maxOutputBytes)
      throw new FormaError('OUTPUT_LIMIT', 'Image exceeds output byte limit');
    return {
      body,
      width,
      height,
      layoutWidth,
      layoutHeight,
      scale,
      format: request.format,
      warnings,
    };
  }
}
