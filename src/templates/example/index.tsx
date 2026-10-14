import { z } from 'zod';
import { textStyle } from '../../core/card.js';
import type { Template } from '../../core/types.js';

const schema = z
  .object({
    text: z.string().min(1).max(4000).describe('纯文本内容，保留换行'),
  })
  .strict();

export const example: Template<z.infer<typeof schema>> = {
  id: 'example',
  name: '纯文本示例',
  description: '保留换行、自动换行，高度随文本内容自适应。',
  schema,
  sizing: { mode: 'auto-height', width: 620 },
  mock: {
    text: '你好，世界。\nこれはプレーンテキストのサンプルです。\nThis is a plain text example.',
  },
  render: data => <div style={{ display: 'flex', fontSize: 20, ...textStyle }}>{data.text}</div>,
};
