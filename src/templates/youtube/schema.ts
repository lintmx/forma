import { z } from 'zod';
import { assetUrlSchema } from '../../core/asset-url.js';

const count = z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.string().regex(/^\d{1,20}$/)]);
const timestamp = z.iso.datetime({ offset: true });
const thumbnail = z
  .object({
    url: assetUrlSchema.describe('缩略图地址，支持 HTTP(S)、file://、asset:id 或相对路径'),
    width: z.number().int().positive().optional().describe('API 返回的图片宽度'),
    height: z.number().int().positive().optional().describe('API 返回的图片高度'),
  })
  .strict();

export const youtubeSchema = z
  .object({
    id: z
      .string()
      .regex(/^[\w-]{11}$/)
      .optional()
      .describe('YouTube 视频 ID，用于生成底部来源链接'),
    snippet: z
      .object({
        title: z.string().trim().min(1).max(1000).describe('视频或直播标题，最多两行，超出显示省略号'),
        channelTitle: z.string().trim().min(1).max(160).optional().describe('频道名称，最多一行，超出显示省略号'),
        description: z.string().max(8000).optional().describe('简介，保留换行并高亮链接，超过十行折叠'),
        publishedAt: timestamp.optional().describe('发布时间；仅普通视频展示，不作为直播开播时间'),
        liveBroadcastContent: z
          .enum(['none', 'upcoming', 'live'])
          .optional()
          .describe('API 当前直播状态；none 也可能是已结束直播'),
        thumbnails: z
          .object({
            default: thumbnail.optional().describe('默认缩略图'),
            medium: thumbnail.optional().describe('中等缩略图'),
            high: thumbnail.optional().describe('高清缩略图'),
            standard: thumbnail.optional().describe('标准缩略图'),
            maxres: thumbnail.optional().describe('最大尺寸缩略图'),
          })
          .strict()
          .optional()
          .describe('优先加载 maxres、standard、high、medium、default，失败时尝试下一张'),
      })
      .strict()
      .describe('从 videos.list 的 snippet 选取展示字段；只需 title'),
    status: z
      .object({
        privacyStatus: z
          .enum(['private', 'public', 'unlisted'])
          .optional()
          .describe('API 可见性；public 或 unlisted 表示已发布'),
        publishAt: timestamp.optional().describe('普通视频的定时发布时间；已公开时忽略，不用 publishedAt 推断定时发布'),
      })
      .strict()
      .optional()
      .describe('普通视频发布状态；直播仍由 liveBroadcastContent 和 liveStreamingDetails 判断'),
    contentDetails: z
      .object({
        duration: z
          .string()
          .max(40)
          .regex(/^P(?=\d|T\d)(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/)
          .optional()
          .describe('API ISO 8601 时长，例如 PT1H12M45S；0 时长隐藏，直播中不显示'),
      })
      .strict()
      .optional()
      .describe('视频内容信息'),
    statistics: z
      .object({
        viewCount: count.optional().describe('观看次数；仅已发布视频、直播结束和回放展示，不作为在线人数'),
        likeCount: count.optional().describe('点赞数'),
        commentCount: count.optional().describe('评论数'),
      })
      .strict()
      .optional()
      .describe('接受 API 数字字符串或安全整数；使用万/亿缩写，保留 0，隐藏缺失项；发布前和直播中隐藏统计'),
    liveStreamingDetails: z
      .object({
        scheduledStartTime: timestamp.optional().describe('预定开播时间'),
        scheduledEndTime: timestamp.optional().describe('预定结束时间；不据此判断直播已结束'),
        actualStartTime: timestamp.optional().describe('实际开播时间'),
        actualEndTime: timestamp.optional().describe('实际结束时间；优先于 liveBroadcastContent 判断已结束'),
        concurrentViewers: count.optional().describe('当前在线人数，仅正在直播时展示，缺失时不显示为 0'),
      })
      .strict()
      .optional()
      .describe('直播详情；不要仅凭 liveBroadcastContent=none 将历史直播当成普通视频'),
    channelAvatarUrl: assetUrlSchema.optional().describe('可选频道头像，需要从 channels 接口或其他来源补充'),
    timeZone: z
      .string()
      .max(100)
      .refine(value => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Invalid time zone')
      .optional()
      .describe('时间展示的 IANA 时区，默认 Asia/Shanghai'),
    observedAt: timestamp
      .optional()
      .describe('本次 API 数据采集时间；用于计算已播时长，不使用服务器当前时间或按计划时间推断已开播'),
    replayAvailable: z
      .boolean()
      .optional()
      .describe('调用方确认回放已可播放时传 true；仅有 actualEndTime 时显示直播已结束'),
  })
  .strict();

export type YoutubeData = z.infer<typeof youtubeSchema>;
