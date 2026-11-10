import { z } from 'zod';
import type { TemplateRegistry } from '../../src/core/registry.js';
import type { Template } from '../../src/core/types.js';
import { textStyle } from '../../src/core/typography.js';

// Minimal renderer fixtures; these are never registered by the production entry point.
const schema = z
  .object({
    title: z.string().min(1).max(160),
    body: z.string().max(4000).optional(),
    rows: z.array(z.string().min(1).max(400)).max(30).default([]),
    image: z.url().optional(),
  })
  .strict();
type Content = z.infer<typeof schema>;

const contentFixture: Template<Content> = {
  id: 'test-content',
  name: 'Content fixture',
  description: 'Intrinsic width and natural height',
  schema,
  sizing: { mode: 'content', minWidth: 420, maxWidth: 760 },
  mock: { title: '你好、世界 Hello ✨', body: '中文 日本語 English', rows: ['First row', 'Second row'] },
  assets: async (data, images) => (data.image ? { image: await images.get(data.image) } : {}),
  render: (data, context) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'block', fontSize: 30, fontWeight: 700, ...textStyle, lineHeight: 1.3 }}>{data.title}</div>
      {data.body && <div style={{ display: 'block', marginTop: 16, fontSize: 18, ...textStyle }}>{data.body}</div>}
      {data.rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {data.rows.map((row, index) => (
            <div key={index} style={{ display: 'block', fontSize: 17, ...textStyle }}>
              {row}
            </div>
          ))}
        </div>
      )}
      {context.assets.image && <img src={context.assets.image.src} width={80} height={80} />}
    </div>
  ),
};

const autoHeightFixture: Template<Content> = {
  ...contentFixture,
  id: 'test-auto-height',
  name: 'Auto-height fixture',
  description: 'Fixed width and natural height',
  sizing: { mode: 'auto-height', width: 620 },
};

export function registerTestTemplates(registry: TemplateRegistry) {
  registry.register(contentFixture).register(autoHeightFixture);
}
