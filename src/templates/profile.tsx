import { z } from 'zod';
import type { Template } from '../core/types.js';
import { colors, Tag, textStyle } from './shared.js';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  handle: z.string().max(80).optional(),
  bio: z.string().max(2400).optional(),
  avatar: z.url().max(2048).refine(url => ['http:', 'https:'].includes(new URL(url).protocol), 'Avatar must be an HTTP(S) URL').optional(),
  tags: z.array(z.string().min(1).max(32)).max(8).default([]),
  stats: z.array(z.object({ label: z.string().min(1).max(24), value: z.string().min(1).max(24) }).strict()).max(4).default([]),
}).strict();
type Profile = z.infer<typeof schema>;

export const profile: Template<Profile> = {
  id: 'profile', name: '用户资料', description: '头像、简介、标签与数据，固定宽度、自适应高度。',
  schema, sizing: { mode: 'auto-height', width: 620 },
  mock: {
    name: '林 · Rin', handle: '@rin_creates',
    bio: '记录日常，保持好奇。\nデザインとコードで、暮らしを少し楽しく。\nBuilding little things with care.',
    tags: ['设计', '開発', 'Open source'], stats: [{ label: '连续记录', value: '30 天' }, { label: '作品', value: '128' }, { label: '关注者', value: '2.4k' }],
  },
  documentation: 'profile — 用户资料\n\n必填 name：1–80 字符。\n可选 handle：最多 80 字符；bio：最多 2400 字符。\navatar：公开 HTTP(S) PNG/JPEG/WebP 图片 URL。加载失败显示名字首字占位并返回 X-Render-Warnings。\ntags：最多 8 个标签，每个 1–32 字符。\nstats：最多 4 项，每项包含 label、value（1–24 字符）。\n未知字段拒绝。\n尺寸：固定 620px 宽度；高度由 Satori 文本换行和布局决定。\n',
  assets: async (data, images) => data.avatar ? { avatar: await images.get(data.avatar) } : {},
  render: (data, context) => <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      {context.assets.avatar
        ? <img src={context.assets.avatar} width={80} height={80} style={{ borderRadius: 24, objectFit: 'cover' }} />
        : <div style={{ display: 'flex', flexShrink: 0, width: 80, height: 80, borderRadius: 24, backgroundColor: '#dfeee7', color: colors.accent, fontSize: 36, alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{[...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(data.name)][0]?.segment}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 6 }}>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, ...textStyle, lineHeight: 1.3 }}>{data.name}</div>
        {data.handle && <div style={{ display: 'flex', fontSize: 15, color: colors.muted, ...textStyle }}>{data.handle}</div>}
      </div>
    </div>
    {data.bio && <div style={{ display: 'flex', marginTop: 26, fontSize: 17, color: colors.muted, ...textStyle }}>{data.bio}</div>}
    {data.tags.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>{data.tags.map((tag, i) => <Tag key={i}>{tag}</Tag>)}</div>}
    {data.stats.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 28, paddingTop: 24, borderTop: '1px solid ' + colors.border, gap: 20 }}>
      {data.stats.map((stat, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', width: 140, gap: 5 }}>
        <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, ...textStyle }}>{stat.value}</div>
        <div style={{ display: 'flex', fontSize: 13, color: colors.muted, ...textStyle }}>{stat.label}</div>
      </div>)}
    </div>}
  </div>,
};
