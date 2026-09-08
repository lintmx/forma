import { useState } from 'react';
import type { CardMedia } from '../../../src/types/card';

interface MediaGridProps {
  media?: CardMedia[];
}

function MediaItem({ media, index }: { media: CardMedia; index: number }) {
  const [hasError, setHasError] = useState(false);
  const mediaType = media.type ?? 'image';
  const previewUrl = media.previewUrl ?? media.url;

  return (
    <div className="media-grid__item" data-media-type={mediaType}>
      {mediaType === 'audio' && !media.previewUrl ? (
        <div className="media-grid__audio">音频</div>
      ) : hasError ? (
        <div className="media-grid__error">图片加载失败</div>
      ) : (
        <img
          src={previewUrl}
          alt={media.alt ?? `图片 ${index + 1}`}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      )}
      {mediaType === 'video' && <span className="media-grid__overlay">▶</span>}
      {mediaType === 'gif' && <span className="media-grid__badge">GIF</span>}
      {mediaType === 'audio' && media.previewUrl && <span className="media-grid__badge">音频</span>}
    </div>
  );
}

export function MediaGrid({ media }: MediaGridProps) {
  if (!media?.length) {
    return null;
  }

  return (
    <div className="media-grid" data-count={Math.min(media.length, 4)}>
      {media.map((item, index) => (
        <MediaItem key={`${item.url}-${index}`} media={item} index={index} />
      ))}
    </div>
  );
}
