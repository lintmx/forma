import { z } from 'zod';
import { assetUrlSchema } from '../../core/asset-url.js';

const details = {
  translation: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .describe('该条消息的译文，由调用方提供；保留换行，省略或留空时隐藏'),
  sentAt: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe('该条消息的发送时间，显示在消息下方；按输入文本展示，不自动解析日期'),
};

const sender = {
  ...details,
  side: z.enum(['left', 'right']).optional().describe('消息方向，默认 left；right 为自己发送的蓝色气泡'),
  name: z.string().trim().max(80).optional().describe('发送者昵称，省略时不显示昵称'),
  avatarUrl: assetUrlSchema.optional().describe('头像地址，支持相对路径和 asset: 附件；缺失时显示昵称首字'),
  time: z.string().trim().max(80).optional().describe('显示在该消息上方的居中时间标签，不自动解析日期'),
};

export const chatSchema = z
  .object({
    title: z.string().trim().min(1).max(120).describe('聊天对象或群聊名称'),
    subtitle: z.string().trim().max(160).optional().describe('标题下的状态或群聊说明，省略时隐藏'),
    showInput: z.boolean().optional().describe('是否展示底部输入栏装饰，默认 true'),
    messages: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              type: z.literal('text').describe('文字消息'),
              ...sender,
              text: z.string().trim().min(1).max(4000).describe('消息正文，保留换行并支持 Emoji'),
            })
            .strict(),
          z
            .object({
              type: z.literal('image').describe('图片消息'),
              ...sender,
              url: assetUrlSchema.describe('图片地址，支持相对路径和 asset: 附件'),
              alt: z.string().trim().max(200).optional().describe('图片说明，加载失败时显示'),
            })
            .strict(),
          z
            .object({
              type: z.literal('system').describe('居中系统提示，也可作为独立时间分隔'),
              ...details,
              text: z.string().trim().min(1).max(400).describe('提示内容'),
            })
            .strict(),
        ]),
      )
      .max(50)
      .describe('按展示顺序排列的消息，最多 50 条；空数组展示空聊天窗口'),
  })
  .strict();

export type ChatData = z.infer<typeof chatSchema>;
