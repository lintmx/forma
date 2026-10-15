import { describe, expect, it } from 'vitest';
import { renderWarningMessage } from '../playground/api.js';

describe('Playground render warnings', () => {
  it('distinguishes images, Emoji and missing glyphs', () => {
    expect(renderWarningMessage('IMAGE_UNAVAILABLE')).toBe('图片资源加载失败，已使用模板的降级内容。');
    expect(renderWarningMessage('EMOJI_UNAVAILABLE')).toBe('部分 Emoji 不可用，已显示占位符。');
    expect(renderWarningMessage('MISSING_GLYPH')).toBe('部分文字缺少字形，已显示占位符。');
  });
  it('combines distinct warnings and handles empty or future warning codes', () => {
    expect(renderWarningMessage('EMOJI_UNAVAILABLE,MISSING_GLYPH,EMOJI_UNAVAILABLE')).toBe(
      '部分 Emoji 不可用，已显示占位符。 部分文字缺少字形，已显示占位符。',
    );
    expect(renderWarningMessage('')).toBe('');
    expect(renderWarningMessage('FUTURE_WARNING')).toBe('渲染存在资源降级，请检查输出。');
  });
});
