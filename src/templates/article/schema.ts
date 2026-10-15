import { z } from 'zod';

const format = z.enum(['markdown', 'text']).optional().describe('正文格式，省略为 markdown；text 按原样保留符号和换行');

export const articleSchema = z
  .object({
    content: z
      .string()
      .min(1)
      .max(20000)
      .refine(value => value.trim().length > 0, '正文不能为空白')
      .describe('文章正文，唯一必填字段；支持 Markdown 或普通文本，自动高亮 Twitter hashtag 和 @提及'),
    contentFormat: format,
    title: z.string().max(400).optional().describe('文章标题，按普通文本展示'),
    author: z.string().max(160).optional().describe('作者名称'),
    authorAvatarUrl: z
      .union([z.literal(''), z.url({ protocol: /^https?$/ }).max(2048)])
      .optional()
      .describe('可选作者头像，公开 HTTP(S) PNG/JPEG/WebP 地址；省略或空字符串时隐藏'),
    publishedAt: z.string().max(160).optional().describe('发布时间，按输入文本展示'),
    translation: z
      .object({
        title: z.string().max(400).optional().describe('标题译文，可独立于正文译文提供'),
        text: z
          .string()
          .max(20000)
          .optional()
          .describe('正文译文，支持 Markdown 或普通文本，与原文相同地高亮 hashtag 和 @提及'),
        format,
        model: z.string().max(160).optional().describe('翻译模型名称'),
        sourceLanguage: z.string().max(80).optional().describe('翻译自语言名称'),
      })
      .strict()
      .optional(),
    source: z.string().max(160).optional().describe('底部来源名称'),
    url: z.string().max(2048).optional().describe('底部原文链接，按普通文本展示'),
  })
  .strict();

export type ArticleData = z.infer<typeof articleSchema>;
