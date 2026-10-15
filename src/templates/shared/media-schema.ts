import { z } from 'zod';

const imageUrl = z.url({ protocol: /^(https?|file)$/ }).max(2048);
export const mediaSchema = z
  .array(
    z
      .object({
        type: z.enum(['image', 'video', 'gif', 'audio']).optional().describe('媒体类型，省略为 image'),
        url: imageUrl.describe('原始媒体地址；图片可直接加载，其他类型建议提供 previewUrl'),
        previewUrl: imageUrl.optional().describe('HTTP(S) 或 file:// PNG/JPEG/WebP 预览图地址'),
        alt: z.string().max(400).optional().describe('媒体描述'),
      })
      .strict(),
  )
  .max(12);

export const mediaLayoutSchema = z.enum(['vertical', 'grid', 'collage']);
export type Media = z.infer<typeof mediaSchema>[number];
export type MediaLayout = z.infer<typeof mediaLayoutSchema>;
