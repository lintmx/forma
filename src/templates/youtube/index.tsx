import type { CSSProperties, ReactNode } from 'react';
import type { Template } from '../../core/types.js';
import { textStyle, typography } from '../../core/typography.js';
import { highlightTextRuns } from '../shared/highlight.js';
import { youtubeMock } from './mock.js';
import { broadcastState, durationSeconds, formatCount, formatSeconds, formatTime } from './presentation.js';
import { youtubePresets } from './presets.js';
import { type YoutubeData, youtubeSchema } from './schema.js';

const ink = '#18181b';
const muted = '#64646c';
const red = '#ff0000';
const border = '0.5px solid #e4e4e7';
const column: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const descriptionLineHeight = Math.ceil(typography.compact.fontSize * 1.6);
const descriptionMaxHeight = descriptionLineHeight * 10;
const labels = {
  published: '已发布',
  scheduled: '定时发布',
  upcoming: '预约直播',
  live: '正在直播',
  ended: '直播结束',
  replay: '直播回放',
  unknown: '直播状态待确认',
};

function Text({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'block', minWidth: 0, ...textStyle, ...style }}>{children}</div>;
}

export const youtube: Template<YoutubeData> = {
  id: 'youtube',
  name: 'YouTube 视频与直播',
  description: '频道、封面、简介与统计，支持普通视频定时发布、已发布及直播预约、直播中、结束、回放；600px 宽度。',
  schema: youtubeSchema,
  sizing: { mode: 'auto-height', width: 600 },
  mock: youtubeMock,
  presets: youtubePresets,
  assets: async (data, images) => {
    const thumbnails = data.snippet.thumbnails;
    const cover = async () => {
      for (const key of ['maxres', 'standard', 'high', 'medium', 'default'] as const) {
        const url = thumbnails?.[key]?.url;
        if (!url) continue;
        const image = await images.get(url).catch(() => undefined);
        if (image) return image;
      }
    };
    const [coverImage, avatar] = await Promise.all([
      cover(),
      data.channelAvatarUrl ? images.get(data.channelAvatarUrl).catch(() => undefined) : undefined,
    ]);
    return {
      ...(Object.values(thumbnails ?? {}).some(Boolean) ? { cover: coverImage } : {}),
      ...(data.channelAvatarUrl ? { avatar } : {}),
    };
  },
  render: (data, context) => {
    const state = broadcastState(data);
    const onAir = state === 'live';
    const isVideo = state === 'scheduled' || state === 'published';
    const finished = state === 'ended' || state === 'replay';
    const live = data.liveStreamingDetails;
    const snippet = data.snippet;
    const mono = context.monospaceFontFamily;
    const timeZone = data.timeZone ?? 'Asia/Shanghai';
    const hasCover = Object.values(snippet.thumbnails ?? {}).some(Boolean);
    const duration = durationSeconds(data.contentDetails?.duration);
    const elapsed =
      onAir && live?.actualStartTime && data.observedAt
        ? Math.max(0, (Date.parse(data.observedAt) - Date.parse(live.actualStartTime)) / 1000)
        : undefined;
    const total =
      finished && live?.actualStartTime && live.actualEndTime
        ? Math.max(0, (Date.parse(live.actualEndTime) - Date.parse(live.actualStartTime)) / 1000)
        : undefined;
    const timeline = (
      state === 'scheduled'
        ? [['预计发布', data.status?.publishAt]]
        : state === 'upcoming'
          ? [
              ['预定开播', live?.scheduledStartTime],
              ['预计结束', live?.scheduledEndTime],
            ]
          : onAir
            ? [
                ['实际开播', live?.actualStartTime],
                ['预计结束', live?.scheduledEndTime],
              ]
            : finished
              ? [
                  ['实际开播', live?.actualStartTime],
                  ['直播结束', live?.actualEndTime],
                ]
              : []
    ).filter((entry): entry is [string, string] => !!entry[1]);
    const stats = (
      [
        ['viewCount', '播放'],
        ['commentCount', '评论'],
        ['likeCount', '点赞'],
      ] as const
    ).filter(([key]) => (state === 'published' || finished) && data.statistics?.[key] !== undefined);
    const metadata =
      state === 'published' && snippet.publishedAt
        ? '发布于 ' + formatTime(snippet.publishedAt, timeZone).slice(0, 10)
        : isVideo
          ? '普通视频'
          : 'YouTube 直播';
    const coverDetail =
      onAir && live?.concurrentViewers !== undefined
        ? formatCount(live.concurrentViewers) + ' 人正在观看'
        : (state === 'published' || state === 'replay') && duration > 0
          ? formatSeconds(duration)
          : state === 'ended' && total !== undefined
            ? '总时长 ' + formatSeconds(total)
            : undefined;
    const badge: CSSProperties = {
      display: 'flex',
      position: 'absolute',
      bottom: 12,
      maxWidth: '90%',
      padding: '5px 9px',
      borderRadius: 4,
      color: '#fff',
      backgroundColor: 'rgba(24,24,27,0.88)',
      ...typography.meta,
    };
    return (
      <div style={{ ...column, gap: 20, color: ink, ...typography.compact }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 12 }}>
            {snippet.channelTitle && (
              <div style={{ display: 'flex', flexShrink: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    overflow: 'hidden',
                    border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f4f4f5',
                    color: ink,
                    fontWeight: 700,
                  }}
                >
                  {context.assets.avatar ? (
                    <img src={context.assets.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{Array.from(snippet.channelTitle)[0]}</span>
                  )}
                </div>
              </div>
            )}
            <div style={{ ...column, flex: 1, gap: 2 }}>
              {snippet.channelTitle && (
                <Text
                  style={{
                    ...typography.compact,
                    lineHeight: 1.3,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {snippet.channelTitle}
                </Text>
              )}
              <Text style={{ ...typography.meta, color: muted }}>{metadata}</Text>
            </div>
          </div>
          <div style={{ display: 'flex', flexShrink: 0, maxWidth: '36%' }}>
            <Text
              style={{
                ...typography.meta,
                padding: '5px 9px',
                borderRadius: 4,
                backgroundColor: onAir ? red : '#f7f7f8',
                color: onAir ? '#fff' : muted,
                fontWeight: 700,
              }}
            >
              {onAir ? 'LIVE' : labels[state]}
            </Text>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: '100%',
            aspectRatio: context.assets.cover ? 16 / 9 : undefined,
            height: context.assets.cover ? undefined : 112,
            borderRadius: 8,
            overflow: 'hidden',
            border,
            backgroundColor: '#f4f4f5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {context.assets.cover ? (
            <img
              src={context.assets.cover}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ ...column, alignItems: 'center', gap: 8, paddingBottom: coverDetail ? 32 : 0, color: muted }}>
              <svg width="28" height="20" viewBox="0 0 28 20">
                <rect width="28" height="20" rx="5" fill="#dedee2" />
                <path d="M11 5.5 19 10 11 14.5Z" fill="#fff" />
              </svg>
              <Text style={typography.meta}>{hasCover ? '封面加载失败' : '暂无封面'}</Text>
            </div>
          )}
          {coverDetail && (
            <div style={{ ...badge, right: 12, alignItems: 'center', gap: 6, fontFamily: mono }}>
              {onAir && <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: red, flexShrink: 0 }} />}
              <Text>{coverDetail}</Text>
            </div>
          )}
        </div>
        <Text style={{ ...typography.section, lineClamp: 2, overflow: 'hidden' }}>{snippet.title}</Text>
        {snippet.description?.trim() && (
          <div style={{ ...column, marginTop: -8, color: muted, lineHeight: descriptionLineHeight + 'px' }}>
            <div style={{ ...column, position: 'relative', maxHeight: descriptionMaxHeight + 20, overflow: 'hidden' }}>
              <Text style={{ flexShrink: 0 }}>
                {highlightTextRuns([{ text: snippet.description.trim() }], { urls: true })}
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
        {(timeline.length > 0 || state === 'upcoming') && (
          <div style={{ ...column, gap: 16, borderTop: border, paddingTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...typography.meta, color: muted }}>
              <Text style={{ flex: 1 }}>{isVideo ? '发布安排' : '直播时间'}</Text>
              {elapsed !== undefined && <Text style={{ fontFamily: mono }}>{'已播 ' + formatSeconds(elapsed)}</Text>}
              {total !== undefined && <Text style={{ fontFamily: mono }}>{'总时长 ' + formatSeconds(total)}</Text>}
              {timeline.length > 0 && <Text>{timeZone === 'Asia/Shanghai' ? 'UTC+8' : timeZone}</Text>}
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              {state === 'upcoming' && !live?.scheduledStartTime && <Text style={{ color: muted }}>开播时间待定</Text>}
              {timeline.map(([label, value]) => (
                <div key={label} style={{ ...column, flex: 1, gap: 6 }}>
                  <Text style={{ ...typography.meta, color: muted }}>{label}</Text>
                  <Text style={{ fontFamily: mono }}>{formatTime(value, timeZone)}</Text>
                </div>
              ))}
            </div>
          </div>
        )}
        {stats.length > 0 && (
          <div
            style={{
              display: 'flex',
              borderTop: border,
              paddingTop: 20,
            }}
          >
            {stats.map(([key, label], index) => (
              <div
                key={key}
                style={{
                  ...column,
                  flex: 1,
                  gap: 4,
                  paddingLeft: index ? 20 : 0,
                  borderLeft: index ? border : undefined,
                }}
              >
                <Text
                  style={{
                    ...typography.section,
                    letterSpacing: -0.5,
                  }}
                >
                  {formatCount(data.statistics![key]!)}
                </Text>
                <Text style={{ ...typography.meta, color: muted }}>{label}</Text>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, borderTop: border }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect width="20" height="14" rx="4" fill={red} />
              <path d="M8 3.5 14 7 8 10.5Z" fill="#fff" />
            </svg>
            <Text style={{ ...typography.meta, fontWeight: 700 }}>YouTube</Text>
          </div>
          {data.id && (
            <Text
              style={{
                ...typography.meta,
                flex: 1,
                color: muted,
                textAlign: 'right',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {'https://www.youtube.com/watch?v=' + data.id}
            </Text>
          )}
        </div>
      </div>
    );
  },
};
