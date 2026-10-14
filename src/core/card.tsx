import type { CSSProperties, ReactNode } from 'react';
import { z } from 'zod';

export const textStyle: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 };
export const colors = { ink: '#182333', muted: '#697586', accent: '#397c68', border: '#e3e8ee' };

export const cardOptionsSchema = z.object({
  watermark: z.string().trim().max(160).optional().describe('卡片外底部水印，最多 160 字符；省略或留空时隐藏'),
});
export type CardOptions = z.infer<typeof cardOptionsSchema>;

// Used for both intrinsic-width measurement and final rendering so templates
// never need to duplicate the frame's padding, border or typography defaults.
export function CardFrame({
  children,
  fontFamily,
  watermark,
  autoWidth = false,
}: CardOptions & { children: ReactNode; fontFamily: string; autoWidth?: boolean }) {
  const width = autoWidth ? undefined : '100%';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        width,
        padding: watermark ? '28px 28px 8px' : 28,
        backgroundColor: 'rgb(245, 245, 245)',
        fontFamily,
        color: colors.ink,
      }}
    >
      <div
        style={{
          display: 'flex',
          boxSizing: 'border-box',
          flexDirection: 'column',
          width,
          padding: 32,
          backgroundColor: '#fff',
          border: '1px solid ' + colors.border,
          borderRadius: 24,
          boxShadow: '0 6px 18px rgba(24,35,51,0.10)',
        }}
      >
        {children}
      </div>
      {watermark && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            width,
            marginTop: 16,
            color: '#9ca3af',
            fontSize: 13,
            fontWeight: 400,
            letterSpacing: 1,
            textAlign: 'center',
            ...textStyle,
            lineHeight: 1.5,
          }}
        >
          {watermark}
        </div>
      )}
    </div>
  );
}
