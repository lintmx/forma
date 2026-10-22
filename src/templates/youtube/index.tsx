import type { CSSProperties, ReactNode } from 'react';
import type { Template } from '../../core/types.js';
import { textStyle, typography } from '../../core/typography.js';
import { highlightTextRuns } from '../shared/highlight.js';
import { SourceFooter } from '../shared/source-footer.js';
import { youtubeMock } from './mock.js';
import { broadcastState, durationSeconds, formatCount, formatSeconds, formatTime } from './presentation.js';
import { type YoutubeData, youtubeSchema } from './schema.js';

const ink = '#0f1419';
const muted = '#536471';
const red = '#ff0000';
const blue = '#1d9bf0';
const border = '1px solid #eff3f4';
const column: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const panel: CSSProperties = { backgroundColor: '#f7f9fa', border, borderRadius: 14, padding: 16 };
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
    const accent = onAir ? red : state === 'scheduled' || state === 'upcoming' || state === 'replay' ? blue : muted;
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
        : labels[state];
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
      bottom: 10,
      maxWidth: '65%',
      padding: '2px 7px',
      borderRadius: 4,
      color: '#fff',
      backgroundColor: 'rgba(15,20,25,0.8)',
      border: '1px solid rgba(255,255,255,0.1)',
      ...typography.meta,
    };
    return (
      <div style={{ ...column, gap: 16, color: ink, ...typography.compact }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 12 }}>
            {snippet.channelTitle && (
              <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: onAir ? '2px solid ' + red : border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f7f9fa',
                    color: muted,
                    fontWeight: 700,
                  }}
                >
                  {context.assets.avatar ? (
                    <img src={context.assets.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{Array.from(snippet.channelTitle)[0]}</span>
                  )}
                </div>
                {onAir && (
                  <div
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      padding: '0 3px',
                      borderRadius: 8,
                      backgroundColor: red,
                      color: '#fff',
                      fontSize: 8,
                      fontFamily: mono,
                    }}
                  >
                    LIVE
                  </div>
                )}
              </div>
            )}
            <div style={{ ...column, flex: 1, gap: 2 }}>
              {snippet.channelTitle && (
                <Text
                  style={{
                    ...typography.body,
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
          <div style={{ ...column, alignItems: 'flex-end', maxWidth: '36%', gap: 4 }}>
            <Text
              style={{
                ...typography.meta,
                padding: '4px 10px',
                borderRadius: 20,
                backgroundColor: onAir ? '#fef2f2' : '#f0f2f5',
                color: onAir ? red : muted,
                border: onAir ? '1px solid #fbd3d6' : border,
              }}
            >
              {isVideo ? '普通视频' : '直播'}
            </Text>
            {data.id && <Text style={{ ...typography.meta, color: '#8b98a5', fontFamily: mono }}>{data.id}</Text>}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: 14,
            overflow: 'hidden',
            border,
            backgroundColor: '#f7f9fa',
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
            <Text style={{ color: muted }}>{hasCover ? '封面加载失败' : '暂无封面'}</Text>
          )}
          <Text style={{ ...badge, left: 10, maxWidth: '32%', backgroundColor: accent, fontWeight: 700 }}>
            {labels[state]}
          </Text>
          {coverDetail && (
            <div style={{ ...badge, right: 10, alignItems: 'center', gap: 5, fontFamily: mono }}>
              {onAir && <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: red, flexShrink: 0 }} />}
              <Text>{coverDetail}</Text>
            </div>
          )}
        </div>
        <Text style={{ ...typography.large, lineHeight: 1.4, fontWeight: 700, lineClamp: 2, overflow: 'hidden' }}>
          {snippet.title}
        </Text>
        {snippet.description?.trim() && (
          <div style={{ ...column, ...panel, padding: 14, color: muted, lineHeight: descriptionLineHeight + 'px' }}>
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
                  backgroundColor: panel.backgroundColor,
                  ...typography.compact,
                }}
              >
                …
              </div>
            </div>
          </div>
        )}
        {state !== 'published' && (
          <div
            style={{ ...panel, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
          >
            <div style={{ ...column, gap: 4, flexShrink: 0 }}>
              <Text style={{ ...typography.meta, color: muted }}>{isVideo ? '发布状态' : '直播状态'}</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accent, fontWeight: 700 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, flexShrink: 0 }} />
                <Text>{labels[state]}</Text>
              </div>
              {state === 'replay' && <Text style={{ ...typography.meta, color: muted }}>回放已可观看</Text>}
              {elapsed !== undefined && (
                <Text style={{ ...typography.meta, fontFamily: mono }}>{'已播 ' + formatSeconds(elapsed)}</Text>
              )}
              {total !== undefined && (
                <Text style={{ ...typography.meta, fontFamily: mono }}>{'总时长 ' + formatSeconds(total)}</Text>
              )}
            </div>
            <div style={{ ...column, alignItems: 'flex-end', flex: 1, gap: 6 }}>
              {state === 'upcoming' && !live?.scheduledStartTime && <Text style={{ color: muted }}>开播时间待定</Text>}
              {timeline.map(([label, value]) => (
                <div key={label} style={{ ...column, alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ ...typography.meta, color: muted }}>{label}</Text>
                  <Text style={{ fontWeight: 700, fontFamily: mono, textAlign: 'right' }}>
                    {formatTime(value, timeZone)}
                  </Text>
                </div>
              ))}
              {timeline.length > 0 && (
                <Text style={{ ...typography.meta, color: '#8b98a5' }}>
                  {timeZone === 'Asia/Shanghai' ? 'UTC+8' : timeZone}
                </Text>
              )}
            </div>
          </div>
        )}
        {stats.length > 0 && (
          <div
            style={{
              ...panel,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            {stats.map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 6, maxWidth: '100%' }}>
                <Text style={{ ...typography.meta, color: muted, flexShrink: 0 }}>{label}</Text>
                <Text
                  style={{
                    ...typography.large,
                    lineHeight: 1.4,
                    fontWeight: 700,
                    fontFamily: mono,
                    flexShrink: 1,
                  }}
                >
                  {formatCount(data.statistics![key]!)}
                </Text>
              </div>
            ))}
          </div>
        )}
        <SourceFooter
          source="YouTube"
          url={data.id ? 'https://www.youtube.com/watch?v=' + data.id : undefined}
          marginTop={0}
        />
      </div>
    );
  },
};
