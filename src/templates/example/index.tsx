import { z } from 'zod';
import { textStyle } from '../../core/card.js';
import type { Template } from '../../core/types.js';

const schema = z
  .object({
    text: z.string().min(1).max(4000).describe('纯文本内容，保留换行'),
    monospace: z.boolean().optional().describe('使用 Maple Mono CN 等宽字体；默认使用正文字体'),
  })
  .strict();

export const example: Template<z.infer<typeof schema>> = {
  id: 'example',
  name: '纯文本示例',
  description: '保留换行、自动换行，高度随文本内容自适应；可选择正文或等宽字体。',
  schema,
  sizing: { mode: 'auto-height', width: 620 },
  mock: {
    text: '你好，世界。\nこれはプレーンテキストのサンプルです。\nThis is a plain text example.\n안녕하세요, 세계.',
    monospace: false,
  },
  render: (data, context) => (
    <div
      style={{
        display: 'flex',
        fontSize: 20,
        fontFamily: data.monospace ? context.monospaceFontFamily : context.fontFamily,
        ...textStyle,
      }}
    >
      {data.text}
    </div>
  ),
};
