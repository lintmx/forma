import type { Template } from '../../core/types.js';
import { comparisonMock } from './mock.js';
import type { ComparisonData } from './schema.js';

export const comparisonPresets: NonNullable<Template<ComparisonData>['presets']> = [
  ...(['metric', 'text', 'diff', 'entity'] as const).map(type => ({
    id: type,
    name: { metric: '指标变化', text: '文本前后对照', diff: '逐行文本差异', entity: '关注变化' }[type],
    data: {
      title: '账号数据更新',
      time: comparisonMock.time,
      modules: comparisonMock.modules.filter(module => module.type === type),
    },
  })),
  {
    id: 'image',
    name: '图片前后对照',
    data: {
      title: '封面更新',
      modules: [
        {
          type: 'image',
          before: {
            url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&h=400&q=82',
            label: '原封面',
          },
          after: {
            url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&h=400&q=82',
            label: '新封面',
          },
        },
      ],
    },
  },
  {
    id: 'missing-image',
    name: '缺少图片',
    data: { title: '封面更新', modules: [{ type: 'image', before: { url: '' }, after: { url: '' } }] },
  },
];
