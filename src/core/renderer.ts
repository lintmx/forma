import {
  type FontLoader,
  type ImageSource,
  type Node,
  setGlyphCacheMaxBytes,
  Renderer as TakumiRenderer,
} from '@takumi-rs/core';
import { fromJsx } from '@takumi-rs/helpers/jsx';
import { imageSize } from 'image-size';
import type { Config } from '../config.js';
import { CardFrame } from './card.js';
import { prepareEmoji } from './emoji.js';
import { FormaError } from './errors.js';
import type { LoadedFonts } from './fonts.js';
import { ImageStore } from './images.js';
import type { TemplateRegistry } from './registry.js';
import { type Attachments, type RenderRequest, renderRequestSchema } from './request.js';
import { fitTables, layoutOptions } from './sizing.js';
import type { RenderResult, TemplateContext } from './types.js';

setGlyphCacheMaxBytes(8 * 1024 * 1024);

function visibleCodepoints(node: Node, points = new Set<number>()) {
  if (node.type === 'text') {
    for (const character of node.text) {
      if (!/[\p{Default_Ignorable_Code_Point}\p{Control}\p{White_Space}]/u.test(character))
        points.add(character.codePointAt(0)!);
    }
  } else if (node.type === 'container') {
    for (const child of node.children ?? []) visibleCodepoints(child, points);
  }
  return [...points].sort((a, b) => a - b).map(point => [point, point] as [number, number]);
}

export class Renderer {
  private images: ImageStore;
  private engine = new TakumiRenderer({ cacheMaxBytes: 32 * 1024 * 1024 });
  private ready: Promise<void>;
  private sequence = 0;
  constructor(
    private config: Config,
    private fonts: LoadedFonts,
    private registry: TemplateRegistry,
  ) {
    this.images = new ImageStore(config);
    this.ready = this.initialize();
  }
  private async initialize() {
    for (const font of this.fonts.fonts) await this.engine.registerFont(font);
  }
  async warmup() {
    await this.ready;
    const images = new Map<string, ImageSource>();
    const node = await prepareEmoji(
      {
        type: 'container',
        children: [
          { type: 'text', text: 'Ready 中文 👋', style: { fontFamily: this.fonts.fontFamily } },
          { type: 'text', text: 'const 中文 = 1;', style: { fontFamily: this.fonts.monospaceFontFamily } },
        ],
      },
      () => {
        throw new Error('Warmup Emoji is unavailable');
      },
      images,
    );
    await this.engine.render(node, {
      width: 400,
      height: 120,
      devicePixelRatio: 2,
      images: [...images.values()],
      format: 'png',
    });
  }
  async render(request: RenderRequest, attachments: Attachments = new Map()): Promise<RenderResult> {
    await this.ready;
    const options = renderRequestSchema.safeParse(request);
    if (!options.success) throw new FormaError('VALIDATION_ERROR', 'Invalid render options', 400, options.error.issues);
    const { watermark, assetUrlPrefix } = options.data;
    const template = this.registry.get(request.template);
    const data = this.registry.validate(request.template, request.data);
    const warnings = new Set<string>();
    const images = await this.images.withAttachments(attachments, assetUrlPrefix);
    let assets: TemplateContext['assets'] = {};
    if (template.assets) {
      try {
        assets = await template.assets(data, images);
        if (Object.values(assets).some(asset => asset === undefined)) warnings.add('IMAGE_UNAVAILABLE');
      } catch {
        warnings.add('IMAGE_UNAVAILABLE');
      }
    }
    const diagnosticFamily = 'Forma Missing Glyph ' + this.sequence++;
    const fallback = ', ' + [...new Set(this.fonts.fonts.map(font => JSON.stringify(font.name)))].join(', ');
    const context = {
      assets,
      fontFamily: this.fonts.fontFamily + fallback + ', ' + JSON.stringify(diagnosticFamily),
      monospaceFontFamily: this.fonts.monospaceFontFamily + fallback + ', ' + JSON.stringify(diagnosticFamily),
    };
    const sources = new Map<string, ImageSource>();
    for (const asset of Object.values(assets)) {
      if (!asset) continue;
      // A request-local upload keeps its no-cache policy when a remote source has identical bytes.
      if (sources.get(asset.src)?.cache !== 'none') sources.set(asset.src, asset);
    }
    const converted = await fromJsx(
      CardFrame({
        children: template.render(data, context),
        fontFamily: context.fontFamily,
        monospaceFontFamily: context.monospaceFontFamily,
        watermark,
        autoWidth: template.sizing.mode === 'auto-width' || template.sizing.mode === 'content',
      }),
    );
    const node = await prepareEmoji(converted.node, () => warnings.add('EMOJI_UNAVAILABLE'), sources);
    // A lazy, last-choice family is requested by Takumi only when its actual font
    // matcher exhausts the configured stack. No independent cmap guess is needed.
    const unicodeRange = visibleCodepoints(node);
    const diagnostic: FontLoader = {
      name: diagnosticFamily,
      unicodeRange,
      data: () => {
        warnings.add('MISSING_GLYPH');
        return this.fonts.fonts[0]!.data;
      },
    };
    const renderOptions = {
      css: converted.css,
      images: [...sources.values()],
      fonts: unicodeRange.length ? [diagnostic] : [],
      fontFamilies: [...new Set(this.fonts.fonts.map(font => font.name)), diagnosticFamily],
      devicePixelRatio: 2,
      format: 'png' as const,
    };
    try {
      await fitTables(node, this.engine, renderOptions);
      const { width, height } = await layoutOptions(template.sizing, node, this.engine, renderOptions, this.config);
      node.style = { ...node.style, width: width / 2, height: height / 2 };
      const body = await this.engine.render(node, { ...renderOptions, width, height });
      if (body.byteLength > this.config.maxOutputBytes)
        throw new FormaError('OUTPUT_LIMIT', 'Image exceeds output byte limit');
      const actual = imageSize(body);
      if (actual.width !== width || actual.height !== height) throw new Error('Unexpected PNG dimensions');
      return {
        body,
        width,
        height,
        layoutWidth: width / 2,
        layoutHeight: height / 2,
        scale: 2,
        format: 'png',
        warnings: [...warnings],
      };
    } finally {
      this.engine.unregisterFont({ name: diagnosticFamily });
    }
  }
}
