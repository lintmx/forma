import { Resvg } from '@resvg/resvg-js';
import satori, { type Font, type SatoriOptions } from 'satori';
import type { Config } from '../config.js';
import { registry } from '../templates/index.js';
import { CardFrame, cardOptionsSchema } from './card.js';
import { additionalAsset } from './emoji.js';
import { FormaError } from './errors.js';
import { ImageStore } from './images.js';
import { encodePng } from './png.js';
import { assertDimensions, layoutOptions, svgDimensions } from './sizing.js';
import type { RenderRequest, RenderResult, TemplateContext } from './types.js';
import { MAX_RENDER_SCALE } from './types.js';

export class Renderer {
  private images: ImageStore;
  constructor(
    private config: Config,
    private fonts: Font[],
  ) {
    this.images = new ImageStore(config);
  }
  async render(request: RenderRequest): Promise<RenderResult> {
    const requestedScale = request.scale ?? 1;
    if (!Number.isInteger(requestedScale) || requestedScale < 1 || requestedScale > MAX_RENDER_SCALE) {
      throw new FormaError('VALIDATION_ERROR', 'scale must be an integer between 1 and ' + MAX_RENDER_SCALE, 400);
    }
    const options = cardOptionsSchema.safeParse(request);
    if (!options.success) throw new FormaError('VALIDATION_ERROR', 'Invalid render options', 400, options.error.issues);
    const { watermark } = options.data;
    // SVG stays vector-based at its logical size; only PNG is supersampled.
    const scale = request.format === 'png' ? requestedScale : 1;
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
      fontFamily: this.fonts
        .map(f => f.name)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', '),
    };
    const base: Omit<SatoriOptions, 'width' | 'height'> = {
      fonts: this.fonts,
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
        })
      : undefined;
    const dimensions = await layoutOptions(template.sizing, measure, base, this.config);
    const card = CardFrame({
      children: template.render(data, context),
      fontFamily: context.fontFamily,
      watermark,
      autoWidth: template.sizing.mode === 'auto-width',
    });
    const svg = await satori(card, { ...base, ...dimensions });
    const { width: layoutWidth, height: layoutHeight } = svgDimensions(svg);
    const width = layoutWidth * scale;
    const height = layoutHeight * scale;
    // Apply limits to the raster allocation, not just the unscaled SVG.
    assertDimensions(width, height, this.config);
    if (Buffer.byteLength(svg) > this.config.maxOutputBytes)
      throw new FormaError('OUTPUT_LIMIT', 'SVG exceeds output byte limit');
    const body =
      request.format === 'svg'
        ? Buffer.from(svg)
        : await encodePng(
            new Resvg(svg, {
              font: { loadSystemFonts: false },
              fitTo: { mode: 'zoom', value: scale },
            }).render(),
          );
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
