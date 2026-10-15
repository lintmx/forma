import { imageSize } from 'image-size';
import type { CSSProperties, ReactNode } from 'react';
import type { TemplateContext } from '../../core/types.js';
import { colors, typography } from '../../core/typography.js';
import type { Media, MediaLayout } from './media-schema.js';

function imageRatio(source?: string) {
  if (!source) return 4 / 3;
  const { width, height } = imageSize(Buffer.from(source.slice(source.indexOf(',') + 1), 'base64'));
  return width / height;
}

function MediaItem({
  item,
  source,
  style,
  cropped = false,
}: {
  item: Media;
  source?: string;
  style?: CSSProperties;
  cropped?: boolean;
}) {
  const audio = item.type === 'audio' && !item.previewUrl;
  return (
    <div
      style={{
        display: 'flex',
        boxSizing: 'border-box',
        position: 'relative',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#f6f7f8',
        ...style,
        ...(!cropped && source ? { aspectRatio: imageRatio(source) } : {}),
      }}
    >
      {source ? (
        <img
          src={source}
          alt={item.alt ?? ''}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            objectFit: cropped ? 'cover' : 'contain',
          }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: cropped ? '100%' : 120,
            color: colors.muted,
            ...typography.compact,
            ...(audio ? { backgroundImage: 'linear-gradient(135deg, #f6f7f8, #e5e7eb)' } : {}),
          }}
        >
          {audio ? '音频' : '图片加载失败'}
        </div>
      )}
      {item.type === 'video' && (
        <svg
          width={52}
          height={52}
          viewBox="0 0 52 52"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <circle cx="26" cy="26" r="26" fill="rgba(0,0,0,0.75)" />
          <path d="M21 15L37 26L21 37Z" fill="#fff" />
        </svg>
      )}
      {(item.type === 'gif' || (item.type === 'audio' && item.previewUrl)) && (
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 10,
            left: 10,
            padding: '4px 7px',
            borderRadius: 5,
            backgroundColor: 'rgba(17,24,39,0.78)',
            color: '#fff',
            ...typography.meta,
            fontWeight: 700,
          }}
        >
          {item.type === 'gif' ? 'GIF' : '音频'}
        </div>
      )}
    </div>
  );
}

export function MediaList({
  media,
  layout = 'vertical',
  assets,
  prefix,
}: {
  media?: Media[];
  layout?: MediaLayout;
  assets: TemplateContext['assets'];
  prefix: string;
}) {
  if (!media?.length) return null;
  const tile = (index: number, style: CSSProperties, cropped = false) => (
    <MediaItem
      key={index}
      item={media[index]!}
      source={assets[prefix + '-media-' + index]}
      style={style}
      cropped={cropped}
    />
  );
  const column: CSSProperties = { display: 'flex', flexDirection: 'column', width: '100%', gap: 2 };
  const flexible: CSSProperties = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
  let content: ReactNode;
  if (layout === 'vertical') {
    content = <div style={column}>{media.map((_, index) => tile(index, { width: '100%' }))}</div>;
  } else if (layout === 'collage') {
    content = (
      <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
        {media.map((_, index) => tile(index, flexible))}
      </div>
    );
  } else if (media.length === 1) {
    content = tile(
      0,
      { width: '100%', aspectRatio: Math.min(2, Math.max(3 / 4, imageRatio(assets[prefix + '-media-0']))) },
      true,
    );
  } else if (media.length === 3) {
    content = (
      <div style={{ display: 'flex', width: '100%', aspectRatio: 2, gap: 2 }}>
        {tile(0, { ...flexible, height: '100%' }, true)}
        <div style={{ ...column, ...flexible, height: '100%' }}>
          {tile(1, flexible, true)}
          {tile(2, flexible, true)}
        </div>
      </div>
    );
  } else {
    const columns = media.length <= 4 ? 2 : 3;
    content = (
      <div style={column}>
        {Array.from({ length: Math.ceil(media.length / columns) }, (_, row) => (
          <div key={row} style={{ display: 'flex', width: '100%', gap: 2 }}>
            {Array.from({ length: columns }, (_, col) => {
              const index = row * columns + col;
              return index < media.length ? (
                tile(index, { ...flexible, aspectRatio: 1 }, true)
              ) : (
                <div key={index} style={{ display: 'flex', ...flexible }} />
              );
            })}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        boxSizing: 'border-box',
        width: '100%',
        marginBottom: 12,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        backgroundColor: '#e5e7eb',
      }}
    >
      {content}
    </div>
  );
}
