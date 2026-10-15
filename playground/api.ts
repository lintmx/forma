import type { TemplateRegistry } from '../src/core/registry.js';
import type { RenderRequest } from '../src/core/request.js';

export type TemplateMetadata = ReturnType<TemplateRegistry['metadata']>;

export async function render(request: RenderRequest) {
  const response = await fetch('/v1/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const body = await response.json();
    const details = Array.isArray(body.error?.details)
      ? body.error.details
          .map(
            (issue: { path: (string | number)[]; message: string }) =>
              (issue.path.join('.') || 'data') + ': ' + issue.message,
          )
          .join('\n')
      : '';
    throw new Error((body.error?.message ?? '渲染失败') + (details ? '\n' + details : ''));
  }
  return response;
}

const warningMessages: Record<string, string> = {
  IMAGE_UNAVAILABLE: '图片资源加载失败，已使用模板的降级内容。',
  EMOJI_UNAVAILABLE: '部分 Emoji 不可用，已显示占位符。',
  MISSING_GLYPH: '部分文字缺少字形，已显示占位符。',
};

export function renderWarningMessage(warnings: string) {
  return [...new Set(warnings.split(',').filter(Boolean))]
    .map(warning => warningMessages[warning] ?? '渲染存在资源降级，请检查输出。')
    .join(' ');
}
