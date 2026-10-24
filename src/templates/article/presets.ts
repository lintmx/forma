import type { Template } from '../../core/types.js';
import { articleMock } from './mock.js';
import type { ArticleData } from './schema.js';

const article: ArticleData = {
  title: articleMock.title,
  author: articleMock.author,
  publishedAt: articleMock.publishedAt,
  content: articleMock.content,
};
const media = [
  ...articleMock.media!,
  {
    url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&h=400&q=82',
    alt: '山间的旅行记录',
  },
  {
    url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&h=400&q=82',
    alt: '湖边的日常观察',
  },
];

export const articlePresets: NonNullable<Template<ArticleData>['presets']> = [
  { id: 'markdown', name: 'Markdown 正文', data: article },
  {
    id: 'text',
    name: '纯文本正文',
    data: {
      ...article,
      contentFormat: 'text',
      content: '## 观察与记录\n\n**这些符号保持原样**，不会变成标题或加粗。\n保留换行，用自己的节奏记录日常。',
    },
  },
  { id: 'translation', name: '双语文章', data: { ...article, translation: articleMock.translation } },
  ...(['vertical', 'grid', 'collage'] as const).map(mediaLayout => ({
    id: 'images-' + mediaLayout,
    name: { vertical: '图文纵向排列', grid: '图文网格', collage: '图文横向拼接' }[mediaLayout],
    assetUrlPrefix: 'https://images.unsplash.com/',
    data: {
      title: '旅途中的三个片段',
      content: '记录桌前的灵感，也记录山间与湖边的风景。',
      media: media.map(item => ({ ...item, url: item.url.replace('https://images.unsplash.com/', '') })),
      mediaLayout,
    },
  })),
  { id: 'minimal', name: '仅正文', watermark: '', data: { content: '日常里的一点观察，也值得认真记录。' } },
];
