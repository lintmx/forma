import { z } from 'zod';
import type { Template } from '../core/types.js';
import { colors, Tag, textStyle } from './shared.js';

const schema = z.object({
  title: z.string().trim().min(1).max(160).describe('通知标题'),
  description: z.string().max(4000).optional().describe('正文，支持换行'),
  items: z.array(z.string().min(1).max(400)).max(30).default([]).describe('可选列表'),
  label: z.string().max(40).default('通知 · NOTICE'),
  footer: z.string().max(160).optional(),
}).strict();
type Notice = z.infer<typeof schema>;

export const notice: Template<Notice> = {
  id: 'notice', name: '通知卡片', description: '内容决定宽度，正文与列表自然撑开高度。',
  schema, sizing: { mode: 'content', minWidth: 420, maxWidth: 760 },
  mock: {
    title: '签到成功 ✨', description: '今天已经连续签到 30 天。\n小さな一歩が、大きな変化に。Keep going!',
    items: ['连续签到 30 天', '获得 120 积分', '明天见！また明日。'], label: '每日记录 · DAILY', footer: 'FORMA / 让每一条消息都值得被看见',
  },
  documentation: 'notice — 通知卡片\n\n必填 title：1–160 字符。\n可选 description：最多 4000 字符，保留换行。\nitems：最多 30 项，每项 1–400 字符。\nlabel：最多 40 字符；footer：最多 160 字符，显示在卡片内。\n未知字段拒绝。\n尺寸：Satori 测量标题、正文和列表的自然宽度，含边距限制在 420–760px；高度由最终布局决定。超过服务尺寸上限返回 422，不裁切。\n',
  measure: data => <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
    {[{ text: data.title, size: 30, weight: 700 }, { text: data.description ?? '', size: 18, weight: 400 },
      ...data.items.map(text => ({ text: '•  ' + text, size: 17, weight: 400 })),
      { text: data.label, size: 14, weight: 400 }, { text: data.footer ?? '', size: 12, weight: 400 }]
      .map((line, i) => <div key={i} data-measure style={{ display: 'flex', whiteSpace: 'pre', fontSize: line.size, fontWeight: line.weight }}>{line.text}</div>)}
  </div>,
  render: data => <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}><Tag>{data.label}</Tag></div>
    <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: -0.5, ...textStyle, lineHeight: 1.3 }}>{data.title}</div>
    {data.description && <div style={{ display: 'flex', marginTop: 16, fontSize: 18, color: colors.muted, ...textStyle }}>{data.description}</div>}
    {data.items.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, paddingTop: 22, borderTop: '1px solid ' + colors.border }}>
      {data.items.map((item, i) => <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexShrink: 0, width: 6, height: 6, marginTop: 11, borderRadius: 3, backgroundColor: colors.accent }} />
        <div style={{ display: 'flex', flex: 1, minWidth: 0, fontSize: 17, ...textStyle }}>{item}</div>
      </div>)}
    </div>}
    {data.footer && <div style={{ display: 'flex', marginTop: 28, color: '#8b96a4', fontSize: 12, ...textStyle }}>{data.footer}</div>}
  </div>,
};
