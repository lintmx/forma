import type { BilibiliData } from './schema.js';

export const bilibiliMock: BilibiliData = {
  type: 'video',
  author: {
    name: '木工小策_Official',
    uid: '104889218',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96&q=82',
    verified: true,
  },
  category: '创作者手记',
  publishedAt: '03-02 21:05',
  bvid: 'BV1W44y1G7u2',
  aid: '993210481',
  duration: '01:12:45',
  coverUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&h=675&q=82',
  title:
    '耗时180天！用明代榫卯工艺还原《营造法式》斗栱模型：全手工紫光檀打造与 CAD/BIM 三维数字化复原全记录（含完整结构受力测试）',
  description:
    '本工程遵循《营造法式》崇宁重刊本记载，采用尺度比例 1:5。使用紫光檀与金丝楠老料，共包含 412 个独立榫卯构件，零胶水零金属钉卯合。\nhttps://github.com/wood-craft/dougong-bim-specs',
  stats: { views: 10284000, danmaku: 89000, likes: 1249000, coins: 883000, favorites: 652000, shares: 147000 },
};
