import { z } from 'zod';
import { assetUrlPrefixSchema } from './asset-url.js';

export const cardOptionsSchema = z.object({
  watermark: z.string().trim().max(160).optional().describe('卡片外底部水印，最多 160 字符；省略或留空时隐藏'),
});
export type CardOptions = z.infer<typeof cardOptionsSchema>;

export const renderOptionsSchema = cardOptionsSchema.extend({
  assetUrlPrefix: assetUrlPrefixSchema.optional().describe('资源 URL 目录前缀；用于补全图片、媒体及预览图的相对路径'),
});

export const renderRequestSchema = z
  .object({
    template: z.string().min(1).max(64),
    data: z.unknown().refine((value): boolean => value !== undefined, 'data is required'),
    format: z.enum(['png', 'svg']).default('png'),
    ...renderOptionsSchema.shape,
  })
  .strict();
export type RenderRequest = z.infer<typeof renderRequestSchema>;

// Binary attachments are internal transport data, never part of the JSON envelope.
export type Attachments = Map<string, Uint8Array>;
export interface RenderJob {
  request: RenderRequest;
  attachments?: Attachments;
}
