import type { CSSProperties, ReactNode } from 'react';
import { z } from 'zod';

export const textStyle: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 };
export const colors = { ink: '#182333', muted: '#697586', accent: '#397c68', border: '#e3e8ee' };

export const cardOptionsSchema = z.object({
  watermark: z.string().trim().max(160).optional().describe('卡片外底部水印，最多 160 字符；省略或留空时隐藏'),
});
export type CardOptions = z.infer<typeof cardOptionsSchema>;
export const cardDocumentation = '公共外观：统一背景、圆角、边框、阴影和内外边距。\n请求顶层 watermark（与 template、format、scale 并列）：可选底部水印，最多 160 字符，去除首尾空白；省略或留空时隐藏。位于卡片外，浅灰色居中，按可用宽度换行。自适应高度模式自动增加画布高度；固定高度模式需预留足够空间。水印不属于 data，data.watermark 会被拒绝。\n';

// Used for both intrinsic-width measurement and final rendering so templates
// never need to duplicate the frame's padding, border or typography defaults.
export function CardFrame({ children, fontFamily, watermark, autoWidth = false }: CardOptions & { children: ReactNode; fontFamily: string; autoWidth?: boolean }) {
  const width = autoWidth ? undefined : '100%';
  return <div style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', width, padding: watermark ? '28px 28px 8px' : 28, backgroundColor: 'rgb(245, 245, 245)', fontFamily, color: colors.ink }}>
    <div style={{
      display: 'flex', boxSizing: 'border-box', flexDirection: 'column', width, padding: 32,
      backgroundColor: '#fff', border: '1px solid ' + colors.border, borderRadius: 24,
      boxShadow: '0 6px 18px rgba(24,35,51,0.10)',
    }}>{children}</div>
    {watermark && <div style={{
      display: 'flex', justifyContent: 'center', width, marginTop: 16, color: '#9ca3af',
      fontSize: 13, fontWeight: 400, letterSpacing: 1, textAlign: 'center', ...textStyle, lineHeight: 1.5,
    }}>{watermark}</div>}
  </div>;
}
