import { z } from 'zod';
import { assetUrlSchema } from '../../core/asset-url.js';

const name = z.string().max(160).optional().describe('模块标题，省略或留空时隐藏');
const value = z.union([z.string().max(160), z.number()]);
const text = z.string().max(8000);
const image = z
  .object({
    url: z
      .union([z.literal(''), assetUrlSchema])
      .describe('HTTP(S)、file:// 或相对路径的图片地址；空字符串显示暂无图片'),
    label: z.string().max(160).optional().describe('图片标签，默认更新前或更新后'),
  })
  .strict();
export const comparisonSchema = z
  .object({
    title: z.string().max(160).describe('主标题，空白时显示数据对比'),
    subtitle: z.string().max(400).optional().describe('可选副标题'),
    time: z.string().max(80).optional().describe('对比时间或更新时间'),
    modules: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              type: z.literal('metric'),
              name,
              items: z
                .array(z.object({ label: z.string().max(160).optional(), before: value, after: value }).strict())
                .max(50),
            })
            .strict(),
          z.object({ type: z.literal('text'), name, before: text, after: text }).strict(),
          z.object({ type: z.literal('diff'), name, before: text, after: text }).strict(),
          z.object({ type: z.literal('image'), name, before: image, after: image }).strict(),
          z
            .object({
              type: z.literal('entity'),
              name,
              items: z
                .array(
                  z
                    .object({
                      name: z.string().max(160),
                      handle: z.string().max(160).optional(),
                      bio: z.string().max(2000).optional(),
                      action: z.string().max(160),
                      color: z.enum(['green', 'red', 'gray']).optional(),
                    })
                    .strict(),
                )
                .max(50),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(30)
      .describe('按顺序显示的指标、文本、逐行差异、图片或实体模块'),
  })
  .strict();
export type ComparisonData = z.infer<typeof comparisonSchema>;
export type ComparisonModule = ComparisonData['modules'][number];
