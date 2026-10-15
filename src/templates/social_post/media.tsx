import type { ImageStore } from '../../core/images.js';
import { postEntries, type SocialPostData } from './schema.js';

export async function loadAssets(data: SocialPostData, images: ImageStore) {
  const sources: [string, string][] = [];
  for (const { post, key } of postEntries(data)) {
    if (post.author?.avatarUrl) sources.push([key + '-avatar', post.author.avatarUrl]);
    post.media?.forEach((item, index) => {
      if (item.type !== 'audio' || item.previewUrl)
        sources.push([key + '-media-' + index, item.previewUrl ?? item.url]);
    });
  }
  // Keep successful previews when another image fails; undefined signals a warning.
  const assets = await Promise.all(
    sources.map(async ([key, url]) => {
      try {
        return [key, await images.get(url)] as const;
      } catch {
        return [key, undefined] as const;
      }
    }),
  );
  return Object.fromEntries(assets);
}
