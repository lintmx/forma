import type { Template } from '../../core/types.js';
import type { YoutubeData } from './schema.js';

const video: YoutubeData = {
  snippet: {
    title: '湖边的一天：旅行影像与剪辑记录',
    channelTitle: 'Forma Studio',
    publishedAt: '2026-10-24T08:00:00Z',
    liveBroadcastContent: 'none',
    description: '记录湖边的光线与风景，分享拍摄和剪辑中的小发现。',
    thumbnails: {
      maxres: {
        url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&h=675&q=82',
      },
    },
  },
  status: { privacyStatus: 'public' },
  contentDetails: { duration: 'PT9M56S' },
  statistics: { viewCount: '124800', likeCount: '1860', commentCount: '84' },
};
const broadcast: YoutubeData = {
  ...video,
  snippet: {
    ...video.snippet,
    title: '旅行影像创作分享：从拍摄到剪辑',
    publishedAt: undefined,
    liveBroadcastContent: 'upcoming',
  },
  status: undefined,
  contentDetails: undefined,
  observedAt: '2026-10-24T13:15:00Z',
  liveStreamingDetails: { scheduledStartTime: '2026-10-24T12:00:00Z' },
};

export const youtubePresets: NonNullable<Template<YoutubeData>['presets']> = [
  { id: 'published', name: '已发布视频', data: video },
  {
    id: 'scheduled',
    name: '定时发布',
    data: { ...video, status: { privacyStatus: 'private', publishAt: '2026-10-25T12:00:00Z' } },
  },
  { id: 'upcoming', name: '预约直播', data: broadcast },
  {
    id: 'live',
    name: '直播中',
    data: {
      ...broadcast,
      snippet: { ...broadcast.snippet, liveBroadcastContent: 'live' },
      liveStreamingDetails: { actualStartTime: '2026-10-24T12:00:00Z', concurrentViewers: '12840' },
    },
  },
  ...(['ended', 'replay'] as const).map(id => ({
    id,
    name: id === 'ended' ? '直播结束' : '可看回放',
    data: {
      ...broadcast,
      snippet: { ...broadcast.snippet, liveBroadcastContent: 'none' as const },
      liveStreamingDetails: { actualStartTime: '2026-10-24T12:00:00Z', actualEndTime: '2026-10-24T14:00:00Z' },
      replayAvailable: id === 'replay',
    },
  })),
  {
    id: 'no-cover',
    name: '无封面与长标题',
    watermark: '',
    data: {
      snippet: {
        title: '从一个想法到完整作品：记录开放创作过程中的每一次尝试、协作与发现，让更多人了解动画背后的故事',
        description: '没有封面时使用紧凑布局。\n简介仍然保留换行。',
      },
    },
  },
];
