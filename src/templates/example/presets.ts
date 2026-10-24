import type { Template } from '../../core/types.js';

export const examplePresets: NonNullable<Template<{ text: string; monospace?: boolean }>['presets']> = [
  {
    id: 'multilingual',
    name: '多语言与 Emoji',
    data: { text: '你好，世界！🌏\nHello, world!\nこんにちは、世界！\n안녕하세요, 세계!\n一起记录生活里的小确幸 ✨' },
  },
  {
    id: 'monospace',
    name: '等宽文本',
    data: {
      text: 'Forma 配置\nformat    png\nscale     2×\nstatus    ready\n\nconst message = "你好，世界";\nconsole.log(message);',
      monospace: true,
    },
  },
  {
    id: 'long',
    name: '长文本自动换行',
    watermark: '',
    data: {
      text:
        '一段文字可以容纳很多细节：窗外的光线、街边的树影，还有日常中偶然出现的灵感。把它们记录下来，让普通的一天也拥有值得回看的片段。\n\n' +
        '长文本会根据可用宽度自然换行，卡片高度随内容增长。中英文可以放在同一段落中：Small moments can tell a meaningful story. '.repeat(
          4,
        ),
    },
  },
];
