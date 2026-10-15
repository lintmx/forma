import type { ReactNode } from 'react';
import type { CardOptions } from './request.js';
import { colors, textStyle, typography } from './typography.js';

// Used for both intrinsic-width measurement and final rendering so templates
// never need to duplicate the frame's padding, border or typography defaults.
export function CardFrame({
  children,
  fontFamily,
  monospaceFontFamily,
  watermark,
  autoWidth = false,
}: CardOptions & { children: ReactNode; fontFamily: string; monospaceFontFamily: string; autoWidth?: boolean }) {
  const width = autoWidth ? undefined : '100%';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        width,
        padding: watermark ? '12px 12px 8px' : 12,
        backgroundColor: 'rgb(245, 245, 245)',
        fontFamily,
        color: colors.ink,
        ...typography.body,
        fontWeight: 400,
        letterSpacing: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          boxSizing: 'border-box',
          flexDirection: 'column',
          width,
          padding: 16,
          backgroundColor: '#fff',
          border: '1px solid ' + colors.border,
          borderRadius: 12,
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
            marginTop: 8,
            color: '#b7bac0',
            fontFamily: monospaceFontFamily,
            ...typography.meta,
            fontWeight: 400,
            letterSpacing: 1,
            textAlign: 'center',
            ...textStyle,
            lineHeight: 1,
          }}
        >
          {watermark}
        </div>
      )}
    </div>
  );
}
