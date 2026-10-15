import { z } from 'zod';

export const cardOptionsSchema = z.object({
  watermark: z.string().trim().max(160).optional().describe('卡片外底部水印，最多 160 字符；省略或留空时隐藏'),
});
export type CardOptions = z.infer<typeof cardOptionsSchema>;

export const renderRequestSchema = z
  .object({
    template: z.string().min(1).max(64),
    data: z.unknown().refine((value): boolean => value !== undefined, 'data is required'),
    format: z.enum(['png', 'svg']).default('png'),
    ...cardOptionsSchema.shape,
  })
  .strict();
export type RenderRequest = z.infer<typeof renderRequestSchema>;
