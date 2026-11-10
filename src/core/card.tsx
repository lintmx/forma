import type { ReactNode } from 'react';
import type { CardOptions } from './request.js';
import { colors, textStyle, typography } from './typography.js';

const outerPadding = 12;
const innerPadding = 16;
const borderWidth = 0.5;
export const cardContentInset = 2 * (outerPadding + innerPadding + borderWidth);

// The same frame participates in measurement and final rendering.
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
        padding: watermark ? `${outerPadding}px ${outerPadding}px 8px` : outerPadding,
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
          padding: innerPadding,
          backgroundColor: '#fff',
          border: `${borderWidth}px solid ${colors.border}`,
          borderRadius: 12,
        }}
      >
        {children}
      </div>
      {watermark && (
        <div
          style={{
            display: 'block',
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
