import type { CardProps } from '../../src/generated/types';
import { CardContainer } from './components/CardContainer';
import { Footer } from './components/Footer';
import { SocialPostBody } from './components/SocialPostBody';
import styles from './Card.module.css';

export default function SocialPostCard({ data }: CardProps<'social_post'>) {
  const replies = data.postKind === 'reply' ? (data.replyChain ?? []) : [];
  const visibleReplies = replies.slice(-9);

  return (
    <CardContainer type="social_post" className={styles.root}>
      {data.postKind === 'reshare' && data.reshare && (
        <div className={styles.reshare}>
          <svg className={styles.reshareIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16V8c0-1.1-.896-2-2-2z" />
          </svg>
          <span>
            {data.reshare.by.name} 转发了
            {data.reshare.publishedAt && ` · ${data.reshare.publishedAt}`}
          </span>
        </div>
      )}

      {visibleReplies.length > 0 && (
        <section className={styles.replyChain}>
          {replies.length > visibleReplies.length && (
            <div className={styles.replyChainToggle}>显示更多回复</div>
          )}
          {visibleReplies.map((reply, index) => (
            <div
              className={styles.replyItem}
              key={`${reply.author?.name ?? reply.author?.handle ?? 'reply'}-${index}`}
            >
              <SocialPostBody post={reply} reply mediaLayout={data.mediaLayout} />
            </div>
          ))}
        </section>
      )}

      <SocialPostBody
        post={data}
        mediaLayout={data.mediaLayout}
        quotedPost={data.postKind === 'quote' ? data.quotedPost : undefined}
      />
      <Footer source={data.source} postUrl={data.postUrl} />
    </CardContainer>
  );
}
