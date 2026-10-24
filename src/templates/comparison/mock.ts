import type { ComparisonData } from './schema.js';

export const comparisonMock: ComparisonData = {
  title: '账号数据更新',
  subtitle: 'Forma / 资料与关注变化',
  time: '2026-10-15 10:30',
  modules: [
    {
      type: 'metric',
      name: '核心指标',
      items: [
        { label: '粉丝数', before: '12,580', after: '13,024' },
        { label: '关注数', before: 328, after: 325 },
        { label: '互动率', before: '3.20%', after: '4.85%' },
      ],
    },
    {
      type: 'text',
      name: '个人简介',
      before: '记录设计与日常。',
      after: '记录设计与日常。\n分享开源工具与创作灵感 ✨',
    },
    {
      type: 'diff',
      name: '更新详情',
      before: '名称：Forma\n状态：内测中\n语言：中文',
      after: '名称：Forma\n状态：正式发布\n语言：中文 / English',
    },
    { type: 'image', name: '封面变化', before: { url: '', label: '原封面' }, after: { url: '', label: '新封面' } },
    {
      type: 'entity',
      name: '关注变化',
      items: [
        { name: '开源设计', handle: '@design', bio: '让好设计触手可及。', action: '+ 新增关注', color: 'green' },
        { name: '旧账号', handle: '@archive', action: '− 取消关注', color: 'red' },
      ],
    },
  ],
};
