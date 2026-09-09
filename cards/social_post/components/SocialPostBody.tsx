import type { SocialPostMediaLayout, SocialPostSnapshot } from '../../../src/types/card';
import { CardHeader } from './CardHeader';
import { Content } from './Content';
import { MediaGrid } from './MediaGrid';
import { Translation } from './Translation';

interface SocialPostBodyProps {
  post: SocialPostSnapshot;
  compact?: boolean;
  reply?: boolean;
  quotedPost?: SocialPostSnapshot;
  mediaLayout?: SocialPostMediaLayout;
}

export function SocialPostBody({
  post,
  compact = false,
  reply = false,
  quotedPost,
  mediaLayout,
}: SocialPostBodyProps) {
  const className = `social-post-body${compact ? ' social-post-body--compact' : ''}${reply ? ' social-post-body--reply' : ''}`;
  const author = post.author
    ? {
        ...post.author,
        handle: post.author.handle ? `@${post.author.handle.replace(/^@/, '')}` : undefined,
      }
    : undefined;

  return (
    <section className={className}>
      <CardHeader author={author} compact={compact} publishedAt={post.publishedAt} />
      <Content text={post.content} />
      {post.translation?.text && <Translation translation={post.translation} />}
      <MediaGrid media={post.media} layout={mediaLayout} />
      {quotedPost && (
        <div className="social-post__quoted">
          <SocialPostBody post={quotedPost} compact mediaLayout={mediaLayout} />
        </div>
      )}
    </section>
  );
}
