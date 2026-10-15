import { z } from 'zod';
import { mediaLayoutSchema, mediaSchema } from '../shared/media-schema.js';

const imageUrl = z.url({ protocol: /^(https?|file)$/ }).max(2048);
const author = z
  .object({
    name: z.string().max(160).optional().describe('作者显示名称'),
    handle: z.string().max(160).optional().describe('账号，允许带或不带 @'),
    avatarUrl: imageUrl.optional().describe('HTTP(S) 或 file:// 头像地址'),
    verified: z.boolean().optional().describe('显示认证标记'),
  })
  .strict();
const translation = z
  .object({
    text: z.string().max(4000).describe('译文，保留换行并识别链接、话题和提及'),
    sourceLanguage: z.string().max(80).optional().describe('原文语言名称'),
    model: z.string().max(160).optional().describe('翻译模型名称'),
  })
  .strict();
const snapshot = z
  .object({
    author: author.optional(),
    content: z.string().max(4000).optional().describe('正文，允许为空以展示纯媒体内容'),
    translation: translation.optional(),
    media: mediaSchema.optional(),
    publishedAt: z.string().max(160).optional().describe('发布时间，按输入文本展示'),
  })
  .strict();

export const socialPostSchema = snapshot
  .extend({
    source: z.string().max(160).optional().describe('底部来源名称'),
    url: z.string().max(2048).optional().describe('底部原文地址，按普通文本展示'),
    postKind: z.enum(['post', 'reply', 'quote', 'reshare']).optional().describe('内容关系，省略为 post'),
    mediaLayout: mediaLayoutSchema.optional().describe('媒体布局，省略为 vertical'),
    replyChain: z.array(snapshot).max(100).optional().describe('仅 reply 展示最近九条，按输入顺序排列'),
    quotedPost: snapshot.optional().describe('仅 quote 展示的引用内容'),
    reshare: z
      .object({
        by: z.object({ name: z.string().max(160) }).strict(),
        publishedAt: z.string().max(160).optional(),
      })
      .strict()
      .optional()
      .describe('仅 reshare 展示的转发人和时间'),
  })
  .strict();

export type SocialPostData = z.infer<typeof socialPostSchema>;
export type PostSnapshot = z.infer<typeof snapshot>;

export function visibleReplies(data: SocialPostData) {
  return data.postKind === 'reply' ? (data.replyChain ?? []).slice(-9) : [];
}

// Use the same visible posts for layout measurement and asset loading.
export function postEntries(data: SocialPostData) {
  return [
    { post: data, key: 'post', compact: false, reply: false },
    ...visibleReplies(data).map((post, index) => ({ post, key: 'reply-' + index, compact: false, reply: true })),
    ...(data.postKind === 'quote' && data.quotedPost
      ? [{ post: data.quotedPost, key: 'quote', compact: true, reply: false }]
      : []),
  ];
}
