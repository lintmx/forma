import { z } from 'zod';
import { textStyle } from '../core/card.js';
import type { Template } from '../core/types.js';

const schema = z.object({
  text: z.string().min(1).max(4000).describe('纯文本内容，保留换行'),
}).strict();

export const example: Template<z.infer<typeof schema>> = {
  id: 'example',
  name: '纯文本示例',
  description: '保留换行、自动换行，高度随文本内容自适应。',
  schema,
  sizing: { mode: 'auto-height', width: 620 },
  mock: {
    text: '你好，世界。\nこれはプレーンテキストのサンプルです。\nThis is a plain text example.',
  },
  documentation: 'example — 纯文本示例\n\n必填 text：1–4000 字符，保留空白和换行。\n按纯文本显示，不解析 Markdown 或 HTML。\n尺寸：固定 620px 宽度，高度随文本自动换行和布局决定。\n未知字段拒绝。\n',
  render: data => <div style={{ display: 'flex', fontSize: 20, ...textStyle }}>{data.text}</div>,
};
