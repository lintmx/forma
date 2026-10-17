import { z } from 'zod';
import { assetUrlSchema } from '../../core/asset-url.js';

export const mediaSchema = z
  .array(
    z
      .object({
        type: z.enum(['image', 'video', 'gif', 'audio']).optional().describe('媒体类型，省略为 image'),
        url: assetUrlSchema.describe('原始媒体 URL 或相对路径；图片可直接加载，其他类型建议提供 previewUrl'),
        previewUrl: assetUrlSchema.optional().describe('HTTP(S)、file:// 或相对路径的 PNG/JPEG/WebP 预览图地址'),
        alt: z.string().max(400).optional().describe('媒体描述'),
      })
      .strict(),
  )
  .max(12);

export const mediaLayoutSchema = z.enum(['vertical', 'grid', 'collage']);
export type Media = z.infer<typeof mediaSchema>[number];
export type MediaLayout = z.infer<typeof mediaLayoutSchema>;
