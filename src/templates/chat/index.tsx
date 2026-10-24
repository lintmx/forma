import { imageSize } from 'image-size';
import type { CSSProperties } from 'react';
import type { Template, TemplateContext } from '../../core/types.js';
import { textStyle, typography } from '../../core/typography.js';
import { chatPresets } from './presets.js';
import { type ChatData, chatSchema } from './schema.js';

const column: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0, boxSizing: 'border-box' };
const singleLine: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const blue = '#0874dd';
const muted = '#5d6a7c';

function Message({
  message,
  index,
  assets,
}: {
  message: ChatData['messages'][number];
  index: number;
  assets: TemplateContext['assets'];
}) {
  if (message.type === 'system') {
    return (
      <div style={{ ...column, alignItems: 'center', padding: '2px 0', gap: 6 }}>
        <div
          style={{
            ...column,
            maxWidth: '92%',
            padding: '5px 10px',
            borderRadius: 8,
            backgroundColor: '#e8eef5',
            ...typography.meta,
            color: muted,
            textAlign: 'center',
            ...textStyle,
            gap: 6,
          }}
        >
          <div style={{ display: 'block' }}>{message.text}</div>
          {message.translation && (
            <div style={{ display: 'block', paddingTop: 6, borderTop: '1px solid #d5dfea', ...textStyle }}>
              {message.translation}
            </div>
          )}
        </div>
        {message.sentAt && (
          <div
            style={{
              display: 'block',
              maxWidth: '92%',
              ...typography.meta,
              color: muted,
              textAlign: 'center',
              ...textStyle,
            }}
          >
            {message.sentAt}
          </div>
        )}
      </div>
    );
  }
  const self = message.side === 'right';
  const avatar = assets[index + '-avatar'];
  const picture = assets[index + '-image'];
  const size = picture ? imageSize(Buffer.from(picture.slice(picture.indexOf(',') + 1), 'base64')) : undefined;
  const ratio = size ? size.width / size.height : 4 / 3;
  const imageWidth = Math.min(320, 360 * ratio);
  return (
    <div style={{ ...column, width: '100%', gap: 16 }}>
      {message.time && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '2px 0' }}>
          <div style={{ width: 24, height: 1, backgroundColor: '#d5dfea', flexShrink: 0 }} />
          <div
            style={{
              display: 'block',
              maxWidth: '75%',
              ...typography.meta,
              color: muted,
              textAlign: 'center',
              ...textStyle,
            }}
          >
            {message.time}
          </div>
          <div style={{ width: 24, height: 1, backgroundColor: '#d5dfea', flexShrink: 0 }} />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: self ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          paddingLeft: self ? 46 : 0,
          paddingRight: self ? 0 : 46,
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            boxSizing: 'border-box',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: self ? '#dcecff' : '#e2eaf8',
            color: self ? '#326397' : '#47618c',
            border: '1px solid rgba(255,255,255,0.9)',
            ...typography.body,
            fontWeight: 700,
          }}
        >
          {avatar ? (
            <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{Array.from(message.name || (self ? '我' : '友'))[0]}</span>
          )}
        </div>
        <div style={{ ...column, flex: 1, maxWidth: 390, alignItems: self ? 'flex-end' : 'flex-start', gap: 6 }}>
          {message.name && (
            <div
              style={{
                display: 'block',
                maxWidth: '100%',
                padding: '0 2px',
                ...typography.meta,
                color: muted,
                ...singleLine,
              }}
            >
              {message.name}
            </div>
          )}
          <div
            style={{
              ...column,
              position: 'relative',
              maxWidth: '100%',
              padding: message.type === 'text' ? '10px 13px' : 4,
              borderRadius: self ? '16px 6px 16px 16px' : '6px 16px 16px 16px',
              border: '1px solid ' + (self ? blue : '#e3eaf2'),
              backgroundColor: self ? blue : '#fff',
              backgroundImage: self ? 'linear-gradient(145deg, #0874dd, #0864cc)' : undefined,
              color: self ? '#fff' : '#253247',
            }}
          >
            {message.type === 'text' ? (
              <div style={{ display: 'block', maxWidth: '100%', ...typography.body, ...textStyle }}>{message.text}</div>
            ) : (
              <div
                style={{
                  ...column,
                  alignSelf: 'center',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: imageWidth,
                  height: imageWidth / ratio,
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: '#e8edf3',
                  color: muted,
                }}
              >
                {picture ? (
                  <img src={picture} width={imageWidth} height={imageWidth / ratio} style={{ objectFit: 'contain' }} />
                ) : (
                  <div style={{ ...column, alignItems: 'center', padding: 14, gap: 8, width: '100%' }}>
                    <div style={{ display: 'block', ...typography.compact }}>图片加载失败</div>
                    {message.alt && (
                      <div
                        style={{
                          display: 'block',
                          ...typography.meta,
                          ...textStyle,
                          textAlign: 'center',
                          lineClamp: 3,
                        }}
                      >
                        {message.alt}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {message.translation && (
              <div
                style={{
                  ...column,
                  maxWidth: '100%',
                  margin: message.type === 'text' ? '8px 0 0' : '8px 9px 6px',
                  paddingTop: 8,
                  borderTop: '1px solid ' + (self ? 'rgba(255,255,255,0.3)' : '#e3eaf2'),
                  color: self ? '#e6f1ff' : muted,
                }}
              >
                <div style={{ display: 'block', maxWidth: '100%', ...typography.compact, ...textStyle }}>
                  {message.translation}
                </div>
              </div>
            )}
          </div>
          {message.sentAt && (
            <div
              style={{
                display: 'block',
                boxSizing: 'border-box',
                maxWidth: '100%',
                padding: '0 2px',
                ...typography.meta,
                color: muted,
                textAlign: self ? 'right' : 'left',
                ...textStyle,
              }}
            >
              {message.sentAt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const chat: Template<ChatData> = {
  id: 'chat',
  name: '聊天窗口',
  description:
    '手机 QQ 风格的聊天窗口，支持左右气泡、头像、昵称、逐条译文与发送时间、图片和系统提示；宽度在 440–600px 之间自适应，高度随内容变化。',
  schema: chatSchema,
  sizing: { mode: 'content', minWidth: 440, maxWidth: 600 },
  presets: chatPresets,
  mock: {
    title: '周末出逃计划',
    subtitle: '3 人的群聊',
    messages: [
      {
        type: 'text',
        name: '小夏',
        time: '星期五',
        text: "Let's go to the beach this weekend!\nThe sunsets there are beautiful 🌅",
        translation: '这周末去海边吧！\n听说那边的日落特别好看 🌅',
        sentAt: '18:30',
      },
      {
        type: 'text',
        name: '我',
        side: 'right',
        text: '好呀！我已经开始期待了 ✨',
        translation: "Sounds great! I can't wait ✨",
        sentAt: '18:31',
      },
      { type: 'text', name: '阿泽', text: '我带相机，你们负责开心 📷', sentAt: '18:31' },
      { type: 'system', text: '小夏修改群名为「周末出逃计划」', sentAt: '18:32' },
      { type: 'text', name: '小夏', text: '那就约好啦，明天下午三点见～', sentAt: '18:32' },
      { type: 'text', side: 'right', name: '我', text: '收到，明天见！٩(ˊᗜˋ*)و', sentAt: '18:33' },
    ],
  },
  assets: async (data, images) => {
    const entries = await Promise.all(
      data.messages.flatMap((message, index) => {
        if (message.type === 'system') return [];
        return [
          ...(message.avatarUrl ? [[index + '-avatar', message.avatarUrl]] : []),
          ...(message.type === 'image' ? [[index + '-image', message.url]] : []),
        ].map(async ([key, url]) => [key!, await images.get(url!).catch(() => undefined)] as const);
      }),
    );
    return Object.fromEntries(entries);
  },
  measure: data => {
    const line = (text: string | undefined, style: CSSProperties, inset: number) =>
      text ? (
        <div data-measure style={{ display: 'flex', ...style, whiteSpace: 'pre', marginLeft: inset }}>
          {text}
        </div>
      ) : null;
    return (
      <div style={{ ...column, alignItems: 'flex-start' }}>
        {line(data.title, { ...typography.large, fontWeight: 700 }, 42)}
        {line(data.subtitle, typography.meta, 42)}
        {data.messages.map((message, index) => (
          <div key={index} style={{ ...column, alignItems: 'flex-start' }}>
            {message.type === 'system' ? (
              <>
                {line(message.text, typography.meta, 24)}
                {line(message.translation, typography.meta, 24)}
                {line(message.sentAt, typography.meta, 14)}
              </>
            ) : (
              <>
                {line(message.name, typography.meta, 62)}
                {line(message.time, typography.meta, 50)}
                {line(message.sentAt, typography.meta, 62)}
                {message.type === 'text' ? (
                  line(message.text, typography.body, 74)
                ) : (
                  <div data-measure style={{ display: 'flex', width: 320, height: 1, marginLeft: 65 }} />
                )}
                {line(message.translation, typography.compact, 74)}
              </>
            )}
          </div>
        ))}
      </div>
    );
  },
  render: (data, context) => (
    <div style={{ ...column, width: '100%', color: '#253247' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 2px 16px', gap: 16 }}>
        <svg width={24} height={28} viewBox="0 0 24 28" style={{ flexShrink: 0 }}>
          <path
            d="M15 5L6 14L15 23"
            fill="none"
            stroke={blue}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ ...column, flex: 1, textAlign: 'center', gap: 3 }}>
          <div style={{ display: 'block', ...typography.large, fontWeight: 700, ...singleLine }}>{data.title}</div>
          {data.subtitle && (
            <div style={{ display: 'block', ...typography.meta, color: muted, ...singleLine }}>{data.subtitle}</div>
          )}
        </div>
        <svg width={24} height={28} viewBox="0 0 24 28" style={{ flexShrink: 0 }}>
          <circle cx={4} cy={14} r={2} fill="#535b68" />
          <circle cx={12} cy={14} r={2} fill="#535b68" />
          <circle cx={20} cy={14} r={2} fill="#535b68" />
        </svg>
      </div>
      <div
        style={{
          ...column,
          padding: '20px 14px 24px',
          gap: 16,
          borderRadius: 14,
          backgroundColor: '#f2f5fa',
        }}
      >
        {data.messages.map((message, index) => (
          <Message key={index} message={message} index={index} assets={context.assets} />
        ))}
        {data.messages.length === 0 && (
          <div style={{ ...column, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, color: muted }}>
            <svg width={44} height={44} viewBox="0 0 44 44">
              <path
                d="M9 9H35V29H20L12 35V29H9Z"
                fill="#e0eaf7"
                stroke="#9eb4d0"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <circle cx={16} cy={19} r={1.5} fill="#7892b3" />
              <circle cx={22} cy={19} r={1.5} fill="#7892b3" />
              <circle cx={28} cy={19} r={1.5} fill="#7892b3" />
            </svg>
            <div style={{ display: 'block', ...typography.compact }}>暂无消息</div>
          </div>
        )}
      </div>
      {data.showInput !== false && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 2px 0' }}>
          <svg width={26} height={26} viewBox="0 0 26 26" style={{ flexShrink: 0 }}>
            <circle cx={13} cy={13} r={10.5} fill="none" stroke="#667080" strokeWidth={1.6} />
            <path
              d="M11 9C14 10 14 16 11 17M15 6C20 9 20 17 15 20"
              fill="none"
              stroke="#667080"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              display: 'flex',
              flex: 1,
              boxSizing: 'border-box',
              alignItems: 'center',
              height: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #e3eaf2',
              backgroundColor: '#f5f7fb',
              color: muted,
              ...typography.compact,
            }}
          >
            发消息…
          </div>
          <svg width={26} height={26} viewBox="0 0 26 26" style={{ flexShrink: 0 }}>
            <circle cx={13} cy={13} r={10.5} fill="none" stroke="#667080" strokeWidth={1.6} />
            <circle cx={9} cy={10} r={1.3} fill="#667080" />
            <circle cx={17} cy={10} r={1.3} fill="#667080" />
            <path d="M8 15C10 19 16 19 18 15" fill="none" stroke="#667080" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
          <svg width={26} height={26} viewBox="0 0 26 26" style={{ flexShrink: 0 }}>
            <circle cx={13} cy={13} r={10.5} fill="none" stroke="#667080" strokeWidth={1.6} />
            <path d="M7 13H19M13 7V19" fill="none" stroke="#667080" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  ),
};
