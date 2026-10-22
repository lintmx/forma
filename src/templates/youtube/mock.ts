import type { YoutubeData } from './schema.js';

export const youtubeMock: YoutubeData = {
  id: 'aqz-KE-bpKQ',
  snippet: {
    title: 'Big Buck Bunny（2008）｜Blender 开源动画短片',
    channelTitle: 'Blender',
    publishedAt: '2008-05-30T12:00:00Z',
    liveBroadcastContent: 'none',
    thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg' } },
    description: 'Blender Foundation 开放电影项目。\nhttps://www.bigbuckbunny.org',
  },
  status: { privacyStatus: 'public' },
  contentDetails: { duration: 'PT9M56S' },
  statistics: { viewCount: '12480000', likeCount: '186000', commentCount: '8420' },
};
