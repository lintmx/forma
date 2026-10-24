import type { ReactNode } from 'react';
import type { z } from 'zod';
import type { ImageLoader } from './images.js';
import type { RenderRequest } from './request.js';

export type SizeStrategy =
  | { mode: 'fixed'; width: number; height: number }
  | { mode: 'auto-height'; width: number }
  | { mode: 'auto-width'; height: number }
  | { mode: 'content'; minWidth: number; maxWidth: number };

export interface TemplateContext {
  assets: Record<string, string | undefined>;
  fontFamily: string;
  monospaceFontFamily: string;
}

export interface Template<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  // A Zod object schema for content only; render options belong to the request.
  schema: z.ZodType<T>;
  sizing: SizeStrategy;
  mock: T;
  presets?: Array<{
    id: string;
    name: string;
    data: T;
    watermark?: RenderRequest['watermark'];
    assetUrlPrefix?: RenderRequest['assetUrlPrefix'];
  }>;
  // Content-only intrinsic-width probe. The renderer supplies the frame and font.
  measure?: (data: T, context: TemplateContext) => ReactNode;
  assets?: (data: T, images: ImageLoader) => Promise<Record<string, string | undefined>>;
  // Return only the card's inner content. The renderer always adds the shared frame.
  render: (data: T, context: TemplateContext) => ReactNode;
}

export interface RenderResult {
  body: Uint8Array;
  width: number;
  height: number;
  layoutWidth: number;
  layoutHeight: number;
  scale: number;
  format: 'png' | 'svg';
  warnings: string[];
}
