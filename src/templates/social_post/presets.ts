import type { Template } from '../../core/types.js';
import { socialPostMock } from './mock.js';
import type { SocialPostData } from './schema.js';

const post: SocialPostData = {
  author: socialPostMock.author,
  content: '把工作与旅行中的小片段，慢慢收集成生活的灵感。 #日常 @forma',
  publishedAt: '2026-10-24 10:30',
  source: 'Twitter',
  url: 'https://example.com/post/1',
};
const photos = socialPostMock.media!.slice(0, 3).map(item => ({ url: item.previewUrl!, alt: item.alt }));

export const socialPostPresets: NonNullable<Template<SocialPostData>['presets']> = [
  { id: 'text', name: '纯文字', data: post },
  ...(['vertical', 'grid', 'collage'] as const).map(mediaLayout => ({
    id: 'images-' + mediaLayout,
    name: { vertical: '图片纵向排列', grid: '图片网格', collage: '图片横向拼接' }[mediaLayout],
    data: { ...post, media: photos, mediaLayout },
  })),
  { id: 'reply', name: '回复链', data: { ...post, postKind: 'reply', replyChain: socialPostMock.replyChain } },
  {
    id: 'quote',
    name: '引用动态',
    data: {
      ...post,
      postKind: 'quote',
      quotedPost: {
        author: { name: '旅行笔记', handle: 'travel' },
        content: '下次出发，记得给自己留一点慢下来的时间。',
        media: photos.slice(1, 2),
      },
    },
  },
  {
    id: 'reshare',
    name: '转发动态',
    data: { ...post, postKind: 'reshare', reshare: { by: { name: '小夏' }, publishedAt: '2026-10-24 11:00' } },
  },
  {
    id: 'translation',
    name: '带译文',
    data: {
      ...post,
      translation: {
        text: 'Collect small moments from work and travel, and turn them into everyday inspiration.',
        sourceLanguage: '中文',
        model: 'GPT',
      },
    },
  },
  {
    id: 'media-types',
    name: '视频、GIF 与音频',
    data: { ...post, media: socialPostMock.media!.slice(1), mediaLayout: 'grid' },
  },
];
