import type { ArticleData } from './schema.js';

export const articleMock: ArticleData = {
  title: '把日常观察写成一篇文章',
  author: 'Forma 编辑部',
  authorAvatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96&q=82',
  publishedAt: '2026-10-15 10:30',
  contentFormat: 'markdown',
  content:
    '好的文章，从一个**值得记录的细节**开始。无论是工作中的发现，还是生活里的灵感，都可以成为表达的起点。\n\n## 从观察到表达\n\n1. 记录事实，保留具体的场景。\n2. 整理思路，找到文章的主线。\n3. 用简洁的语言，让读者理解你的想法。\n\n> 写作不是堆砌信息，而是让想法变得清晰。\n\n你也可以使用 `Markdown`，加入列表、引用和[参考链接](https://example.com/writing)。\n\n#写作 #日常观察 @forma',
  translation: {
    title: 'Turn everyday observations into an article',
    text: 'A good article starts with a **detail worth remembering**. Discoveries at work and ideas from daily life can both be starting points.\n\n### From observation to expression\n\n- Record the facts and the scene.\n- Organize your thoughts around a central idea.\n- Use clear language to help readers follow.\n\n> Writing helps make ideas clear.\n\n#Writing #EverydayIdeas @forma',
    format: 'markdown',
    model: 'GPT',
    sourceLanguage: '中文',
  },
  media: [
    {
      url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=82',
      alt: '记录日常观察与写作的桌面',
    },
  ],
  mediaLayout: 'vertical',
  source: 'Forma Journal',
  url: 'https://example.com/articles/everyday-observations',
};
