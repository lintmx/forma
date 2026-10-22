import { z } from 'zod';
import { assetUrlSchema } from '../../core/asset-url.js';

const count = z.union([z.number().int().nonnegative(), z.string().trim().min(1).max(40)]);
const id = z.union([z.string().trim().min(1).max(40), z.number().int().nonnegative()]);

export const bilibiliSchema = z
  .object({
    type: z.enum(['video', 'live']).optional().describe('卡片类型，省略为 video'),
    title: z.string().trim().min(1).max(1000).describe('视频或直播间标题，完整展示并自动换行'),
    author: z
      .object({
        name: z.string().trim().min(1).max(160).describe('UP 主或主播名称'),
        uid: id.optional().describe('用户 UID，不含 @uid_ 前缀'),
        avatarUrl: assetUrlSchema.optional().describe('HTTP(S)、file://、asset:id 或相对路径的头像地址'),
        verified: z.boolean().optional().describe('是否显示蓝色认证徽章'),
      })
      .strict()
      .optional()
      .describe('作者信息，省略时隐藏作者区域'),
    coverUrl: assetUrlSchema.optional().describe('16:9 封面图片地址，支持 HTTP(S)、file://、asset:id 或相对路径'),
    category: z.string().trim().max(160).optional().describe('视频分区或直播品类'),
    description: z
      .string()
      .max(8000)
      .optional()
      .describe('简介，保留换行并高亮链接；超过十行折叠并显示省略提示，空白时隐藏'),
    url: z.string().trim().max(2048).optional().describe('底部来源链接，省略时由 BV/AV 号或直播房间号生成'),
    publishedAt: z.string().trim().max(160).optional().describe('视频发布时间，按输入文本展示'),
    bvid: z
      .string()
      .trim()
      .regex(/^BV[0-9A-Za-z]+$/)
      .max(40)
      .optional()
      .describe('视频 BV 号，含 BV 前缀'),
    aid: id.optional().describe('视频 AV 号，不含 av 前缀'),
    duration: z.string().trim().max(40).optional().describe('视频时长，例如 01:12:45'),
    stats: z
      .object({
        views: count.optional().describe('播放量'),
        danmaku: count.optional().describe('弹幕数'),
        likes: count.optional().describe('点赞数'),
        coins: count.optional().describe('投币数'),
        favorites: count.optional().describe('收藏数'),
        shares: count.optional().describe('分享数'),
      })
      .strict()
      .optional()
      .describe('视频统计；数字自动以万/亿缩写，也可传展示文本；缺省项隐藏，0 正常显示'),
    live: z
      .object({
        roomId: id.optional().describe('直播房间号'),
        status: z.enum(['live', 'offline', 'replay']).describe('直播状态：直播中、未开播、轮播中'),
        popularity: count.optional().describe('人气值，数字自动以万/亿缩写，也可传展示文本'),
        startedAt: z.string().trim().max(160).optional().describe('开播时间，按输入文本展示'),
        elapsed: z.string().trim().max(80).optional().describe('已播时长，例如 1时15分；不自动计算'),
      })
      .strict()
      .optional()
      .describe('仅 type=live 展示；省略时显示状态未知，不推断为正在直播'),
  })
  .strict();

export type BilibiliData = z.infer<typeof bilibiliSchema>;
