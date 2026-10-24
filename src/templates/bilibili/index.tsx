import type { CSSProperties, ReactNode } from 'react';
import type { Template } from '../../core/types.js';
import { textStyle, typography } from '../../core/typography.js';
import { highlightTextRuns } from '../shared/highlight.js';
import { SourceFooter } from '../shared/source-footer.js';
import { bilibiliMock } from './mock.js';
import { bilibiliPresets } from './presets.js';
import { type BilibiliData, bilibiliSchema } from './schema.js';

const ink = '#20212b';
const muted = '#686a78';
const pink = '#c93e6d';
const red = '#cc3658';
const border = '1px solid #ececf0';
const column: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const descriptionLineHeight = Math.ceil(typography.compact.fontSize * 1.6);
const descriptionMaxHeight = descriptionLineHeight * 10;

function Text({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'block', minWidth: 0, ...textStyle, ...style }}>{children}</div>;
}

function formatCount(value: string | number) {
  if (typeof value === 'string') return value;
  const divisor = value >= 100000000 ? 100000000 : value >= 10000 ? 10000 : 1;
  return (
    (value / divisor).toLocaleString('en-US', { maximumFractionDigits: 1 }) +
    (divisor === 100000000 ? '亿' : divisor === 10000 ? '万' : '')
  );
}

export const bilibili: Template<BilibiliData> = {
  id: 'bilibili',
  name: 'Bilibili 视频与直播',
  description: 'UP 主、封面、视频简介与统计，或直播状态、人气与开播时间；600px 宽度，高度自适应。',
  schema: bilibiliSchema,
  sizing: { mode: 'auto-height', width: 600 },
  mock: bilibiliMock,
  presets: bilibiliPresets,
  assets: async (data, images) => {
    const entries = await Promise.all(
      [
        ['avatar', data.author?.avatarUrl],
        ['cover', data.coverUrl],
      ]
        .filter((entry): entry is [string, string] => !!entry[1])
        .map(async ([key, url]) => [key, await images.get(url).catch(() => undefined)] as const),
    );
    return Object.fromEntries(entries);
  },
  render: (data, context) => {
    const isLive = data.type === 'live';
    const onAir = isLive && data.live?.status === 'live';
    const mono = context.monospaceFontFamily;
    const identity = isLive ? (data.live?.roomId !== undefined ? '房间 ' + data.live.roomId : undefined) : data.bvid;
    const sourceUrl =
      data.url ||
      (isLive
        ? data.live?.roomId !== undefined
          ? 'https://live.bilibili.com/' + data.live.roomId
          : undefined
        : data.bvid
          ? 'https://www.bilibili.com/video/' + data.bvid
          : data.aid !== undefined
            ? 'https://www.bilibili.com/video/av' + data.aid
            : undefined);
    const metadata = [data.author?.uid !== undefined ? data.author.uid : undefined, isLive ? '' : data.publishedAt]
      .filter(Boolean)
      .join(' / ');
    const primary = (
      [
        ['views', '播放'],
        ['danmaku', '弹幕'],
      ] as const
    ).filter(([key]) => data.stats?.[key] !== undefined);
    const secondary = (
      [
        ['likes', '点赞'],
        ['coins', '投币'],
        ['favorites', '收藏'],
        ['shares', '分享'],
      ] as const
    ).filter(([key]) => data.stats?.[key] !== undefined);
    const badge: CSSProperties = {
      display: 'flex',
      position: 'absolute',
      bottom: 12,
      maxWidth: '70%',
      padding: '4px 8px',
      borderRadius: 6,
      backgroundColor: 'rgba(24,25,35,0.82)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.1)',
      ...typography.meta,
      fontFamily: mono,
    };
    return (
      <div style={{ ...column, color: ink, ...typography.compact, gap: 20 }}>
        <div
          style={{
            display: data.author || metadata ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 12 }}>
            {data.author && (
              <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    overflow: 'hidden',
                    border: onAir ? '2px solid ' + red : border,
                    backgroundColor: '#fceaf0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: pink,
                    ...typography.large,
                    fontWeight: 700,
                  }}
                >
                  {context.assets.avatar ? (
                    <img src={context.assets.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{Array.from(data.author.name)[0]}</span>
                  )}
                </div>
                {onAir && (
                  <div
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      padding: '1px 4px',
                      borderRadius: 4,
                      backgroundColor: red,
                      color: '#fff',
                      fontSize: 9,
                      fontFamily: mono,
                    }}
                  >
                    LIVE
                  </div>
                )}
              </div>
            )}
            <div style={{ ...column, flex: 1, gap: 3 }}>
              {data.author && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Text
                    style={{
                      ...typography.body,
                      lineHeight: 1.3,
                      fontWeight: 700,
                      flexShrink: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {data.author.name}
                  </Text>
                  {data.author.verified && (
                    <svg width={16} height={16} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path
                        fill="#1d9bf0"
                        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
                      />
                    </svg>
                  )}
                </div>
              )}
              {metadata && <Text style={{ ...typography.meta, color: muted, fontFamily: mono }}>{metadata}</Text>}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: '#f6eff2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {context.assets.cover ? (
            <img
              src={context.assets.cover}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{ ...column, alignItems: 'center', gap: 14 }}>
              <svg width={72} height={64} viewBox="0 0 72 64">
                <path
                  d="M23 6l9 10M49 6 40 16M13 18h46a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z"
                  fill="none"
                  stroke="#dba9ba"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M23 32v9m26-9v9M31 44l5 3 5-3"
                  fill="none"
                  stroke={pink}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <Text style={{ ...typography.meta, color: '#87596b', letterSpacing: 2 }}>
                {data.coverUrl ? '封面加载失败' : '暂无封面'}
              </Text>
            </div>
          )}
          {!isLive && data.aid !== undefined && (
            <Text style={{ ...badge, left: 12, maxWidth: '48%' }}>{'av' + data.aid}</Text>
          )}
          {!isLive && data.duration && <Text style={{ ...badge, right: 12, maxWidth: '48%' }}>{data.duration}</Text>}
          {isLive && data.live?.popularity !== undefined && (
            <div style={{ ...badge, right: 12, alignItems: 'center', gap: 5 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path
                  fill={red}
                  d="M12 23c6.075 0 11-4.925 11-11 0-4.66-2.906-8.647-7.003-10.222a.75.75 0 0 0-.967.893C15.656 5.097 15 7.42 15 9c0 1.657-1.343 3-3 3s-3-1.343-3-3c0-2.474 1.488-5.32 2.656-7.23a.75.75 0 0 0-.825-1.127C6.442 1.624 1 6.18 1 12c0 6.075 4.925 11 11 11z"
                />
              </svg>
              <Text>{'人气 ' + formatCount(data.live.popularity)}</Text>
            </div>
          )}
        </div>
        <div style={{ ...column, gap: 10 }}>
          {(data.category || identity) && (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              {data.category && (
                <Text style={{ ...typography.meta, color: pink, fontWeight: 700, flex: 1 }}>{data.category}</Text>
              )}
              {identity && (
                <Text
                  style={{
                    ...typography.meta,
                    color: muted,
                    fontFamily: mono,
                    maxWidth: data.category ? '48%' : '100%',
                  }}
                >
                  {identity}
                </Text>
              )}
            </div>
          )}
          <Text style={{ ...typography.heading, lineHeight: 1.45 }}>{data.title}</Text>
        </div>
        {data.description?.trim() && (
          <div
            style={{
              ...column,
              color: '#60616e',
              lineHeight: descriptionLineHeight + 'px',
            }}
          >
            <div style={{ ...column, position: 'relative', maxHeight: descriptionMaxHeight + 20, overflow: 'hidden' }}>
              <Text style={{ flexShrink: 0 }}>
                {isLive && <span style={{ color: ink, fontWeight: 700 }}>【直播简介】 </span>}
                {highlightTextRuns([{ text: data.description.trim() }], { urls: true })}
              </Text>
              <div
                style={{
                  display: 'flex',
                  position: 'absolute',
                  top: descriptionMaxHeight,
                  left: 0,
                  width: '100%',
                  height: 20,
                  backgroundColor: '#fff',
                  ...typography.compact,
                }}
              >
                …
              </div>
            </div>
          </div>
        )}
        {!isLive && (primary.length > 0 || secondary.length > 0) && (
          <div style={{ ...column, gap: 16 }}>
            {primary.length > 0 && (
              <div style={{ display: 'flex', gap: 24 }}>
                {primary.map(([key, label], index) => (
                  <div key={key} style={{ ...column, flex: 1, gap: 4, justifyContent: 'space-between' }}>
                    <Text style={{ ...typography.title, color: index === 0 ? pink : ink, fontFamily: mono }}>
                      {formatCount(data.stats![key]!)}
                    </Text>
                    <Text style={{ ...typography.meta, color: muted }}>{label}</Text>
                  </div>
                ))}
              </div>
            )}
            {secondary.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  ...(primary.length ? { borderTop: '0.5px solid #eadfe5', paddingTop: 14 } : {}),
                }}
              >
                {secondary.map(([key, label]) => (
                  <div key={key} style={{ ...column, flex: 1, gap: 5, justifyContent: 'space-between' }}>
                    <Text style={{ ...typography.body, fontWeight: 700, fontFamily: mono }}>
                      {formatCount(data.stats![key]!)}
                    </Text>
                    <Text style={{ ...typography.meta, color: muted }}>{label}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {isLive && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
            }}
          >
            <div style={{ ...column, gap: 8, flexShrink: 0 }}>
              <Text style={{ ...typography.meta, color: muted }}>当前状态</Text>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: onAir ? red : muted,
                  ...typography.section,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: onAir ? red : '#8b98a5' }} />
                <span>
                  {data.live?.status === 'live'
                    ? '正在直播'
                    : data.live?.status === 'offline'
                      ? '未开播'
                      : data.live?.status === 'replay'
                        ? '轮播中'
                        : '状态未知'}
                </span>
              </div>
            </div>
            {onAir && (data.live?.startedAt || data.live?.elapsed) && (
              <div style={{ ...column, alignItems: 'flex-end', gap: 8, flex: 1 }}>
                <Text style={{ ...typography.meta, color: muted }}>
                  {data.live.startedAt ? '开播时间' : '已播时长'}
                </Text>
                <Text style={{ fontWeight: 700, fontFamily: mono, textAlign: 'right' }}>
                  {[
                    data.live.startedAt,
                    data.live.elapsed
                      ? data.live.startedAt
                        ? '(已播 ' + data.live.elapsed + ')'
                        : data.live.elapsed
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </Text>
              </div>
            )}
          </div>
        )}
        <SourceFooter source={isLive ? 'Bilibili Live' : 'Bilibili'} url={sourceUrl} marginTop={0} />
      </div>
    );
  },
};
