import { useState } from 'react';
import type { CardMedia, SocialPostMediaLayout } from '../../../src/types/card';

interface MediaGridProps {
  media?: CardMedia[];
  layout?: SocialPostMediaLayout;
}

const MIN_SINGLE_MEDIA_ASPECT_RATIO = 3 / 4;
const MAX_SINGLE_MEDIA_ASPECT_RATIO = 2;

function MediaItem({
  media,
  index,
  singleGridItem = false,
}: {
  media: CardMedia;
  index: number;
  singleGridItem?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const [singleAspectRatio, setSingleAspectRatio] = useState<number>();
  const mediaType = media.type ?? 'image';
  const previewUrl = media.previewUrl ?? media.url;
  const style =
    singleGridItem && singleAspectRatio ? { aspectRatio: singleAspectRatio } : undefined;

  return (
    <div className="media-grid__item" data-media-type={mediaType} style={style}>
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
          onLoad={(event) => {
            if (!singleGridItem) {
              return;
            }

            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight) {
              setSingleAspectRatio(
                Math.min(
                  MAX_SINGLE_MEDIA_ASPECT_RATIO,
                  Math.max(MIN_SINGLE_MEDIA_ASPECT_RATIO, naturalWidth / naturalHeight),
                ),
              );
            }
          }}
        />
      )}
      {mediaType === 'video' && <span className="media-grid__overlay">▶</span>}
      {mediaType === 'gif' && <span className="media-grid__badge">GIF</span>}
      {mediaType === 'audio' && media.previewUrl && <span className="media-grid__badge">音频</span>}
    </div>
  );
}

export function MediaGrid({ media, layout = 'vertical' }: MediaGridProps) {
  if (!media?.length) {
    return null;
  }

  return (
    <div className="media-grid" data-count={media.length} data-layout={layout}>
      {media.map((item, index) => (
        <MediaItem
          key={`${item.url}-${index}`}
          media={item}
          index={index}
          singleGridItem={layout === 'grid' && media.length === 1}
        />
      ))}
    </div>
  );
}
