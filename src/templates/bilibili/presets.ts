import type { Template } from '../../core/types.js';
import { bilibiliMock } from './mock.js';
import type { BilibiliData } from './schema.js';

export const bilibiliPresets: NonNullable<Template<BilibiliData>['presets']> = [
  {
    id: 'video',
    name: '普通视频',
    data: { ...bilibiliMock, title: '手工制作一张榫卯小桌', description: '记录从选材到组装的全过程。' },
  },
  ...(['live', 'offline', 'replay'] as const).map(status => ({
    id: status,
    name: { live: '直播中', offline: '未开播', replay: '轮播中' }[status],
    data: {
      type: 'live' as const,
      title: '木作工坊：一起完成今天的作品',
      author: bilibiliMock.author,
      coverUrl: bilibiliMock.coverUrl,
      category: '手工创作',
      description: '分享制作过程，交流工具与技巧。',
      live: {
        status,
        roomId: 2289410,
        ...(status === 'live' ? { popularity: 1842000, startedAt: '2026-10-24 20:00', elapsed: '1时15分' } : {}),
      },
    },
  })),
  {
    id: 'no-cover',
    name: '无封面与精简信息',
    data: { title: '一段值得记录的日常', type: 'video', stats: { views: 0 } },
    watermark: '',
  },
];
