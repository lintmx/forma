import type { SocialPostData } from './schema.js';

const avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96&q=82';
const workspace = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&h=400&q=82';
const mountains = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&h=400&q=82';
const lake = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&h=400&q=82';
const beach = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&h=400&q=82';

export const socialPostMock: SocialPostData = {
  author: { name: 'News', handle: 'news', avatarUrl: avatar, verified: true },
  source: 'Twitter',
  url: 'https://example.com/post/1',
  postKind: 'reply',
  content:
    '今天也发现了一些值得记录的灵感。\n把喜欢的事情慢慢做成日常，收集工作与旅行中的小片段。 #日常 @forma\n更多记录：https://example.com/notes/1',
  translation: {
    text: '今日も記録したいインスピレーションを見つけました。\n好きなことを少しずつ日常に。仕事や旅の小さな瞬間を集めています。 #日常 @forma\n記録はこちら：https://example.com/notes/1',
    sourceLanguage: '中文',
    model: 'GPT',
  },
  media: [
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&h=800&q=82',
      previewUrl: workspace,
      alt: '明亮的工作空间',
    },
    {
      type: 'video',
      url: 'https://example.com/media/lake-walk.mp4',
      previewUrl: lake,
      alt: '湖畔散步的视频预览',
    },
    {
      type: 'gif',
      url: 'https://example.com/media/mountain-light.gif',
      previewUrl: mountains,
      alt: '山间光影的 GIF 静态预览',
    },
    {
      type: 'audio',
      url: 'https://example.com/media/ocean-sounds.mp3',
      previewUrl: beach,
      alt: '海浪录音的封面',
    },
  ],
  mediaLayout: 'grid',
  replyChain: [
    {
      author: { name: 'Travel Notes', handle: '@travel-notes', avatarUrl: avatar, verified: false },
      content: '日常の小さな発見を、少しずつ記録していこう。 #旅 @news',
      translation: {
        text: '把日常中的小发现，一点点记录下来。 #旅行 @news',
        sourceLanguage: '日文',
        model: 'GPT',
      },
      media: [{ type: 'image', url: lake, previewUrl: lake, alt: '回复中的湖畔风景' }],
      publishedAt: '2026-10-14 10:10',
    },
  ],
  quotedPost: {
    author: { name: 'Open Ideas', handle: 'open-ideas', avatarUrl: avatar, verified: true },
    content: 'Small moments can become lasting inspiration. #Everyday @forma',
    translation: {
      text: '微小的瞬间，也能成为长久的灵感。 #日常 @forma',
      sourceLanguage: '英文',
      model: 'GPT',
    },
    media: [
      {
        type: 'video',
        url: 'https://example.com/media/studio-tour.mp4',
        previewUrl: workspace,
        alt: '引用内容的工作室视频预览',
      },
    ],
    publishedAt: '2026-10-14 09:40',
  },
  reshare: { by: { name: 'Daily Inspiration' }, publishedAt: '2026-10-14 11:00' },
  publishedAt: '2026-10-14 10:30',
};
