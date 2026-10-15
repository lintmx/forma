import type { CSSProperties } from 'react';

// Logical pixels: output supersampling never changes the typography scale.
export const typography = {
  title: { fontSize: 28, fontWeight: 700, lineHeight: 1.3 },
  heading: { fontSize: 24, fontWeight: 700, lineHeight: 1.35 },
  section: { fontSize: 20, fontWeight: 700, lineHeight: 1.35 },
  large: { fontSize: 18, lineHeight: 1.6 },
  body: { fontSize: 16, lineHeight: 1.6 },
  prose: { fontSize: 16, lineHeight: 1.65 },
  compact: { fontSize: 14, lineHeight: 1.5 },
  meta: { fontSize: 12, lineHeight: 1.45 },
  code: { fontSize: 14, lineHeight: 1.55 },
} satisfies Record<string, CSSProperties>;

// Flow deliberately inherits size, weight and line height from its semantic role.
export const textStyle: CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'normal',
  overflowWrap: 'anywhere',
};

export const colors = {
  ink: '#182333',
  muted: '#596579',
  accent: '#397c68',
  border: '#e3e8ee',
  link: '#0969da',
  surface: '#f6f8fa',
};

export const proseSpacing = { paragraph: 12, headingBefore: 24, headingAfter: 12, listItem: 8, indent: 24 };

export function markdownHeading(depth: number): CSSProperties {
  return {
    fontSize: [28, 24, 20, 18, 16, 16][depth - 1] ?? 16,
    fontWeight: 700,
    lineHeight: 1.35,
    ...(depth === 6 ? { color: colors.muted } : {}),
  };
}
