import type { CSSProperties, ReactNode } from 'react';
import { textStyle } from '../../core/card.js';
import type { Template, TemplateContext } from '../../core/types.js';
import { loadAssets, MediaList } from './media.js';
import { socialPostMock } from './mock.js';
import {
  type MediaLayout,
  type PostSnapshot,
  postEntries,
  type SocialPostData,
  socialPostSchema,
  visibleReplies,
} from './schema.js';

const linkColor = '#1d9bf0';
const secondary = '#6b7280';
const column: CSSProperties = {
  display: 'flex',
  boxSizing: 'border-box',
  flexDirection: 'column',
  minWidth: 0,
  width: '100%',
};
// Keep the source template's token boundaries, including excluding numeric-only hashtags.
const inlineTokenPattern =
  /(https?:\/\/[^\s]+|(?<![\p{L}\p{N}])#(?=[\p{L}\p{N}]*\p{L})[\p{L}\p{N}]+|@[\p{L}\p{N}_.-]+)/gu;

function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(inlineTokenPattern)) {
    if (match.index > offset) parts.push(text.slice(offset, match.index));
    parts.push(
      <span key={match.index} style={{ color: linkColor }}>
        {match[0]}
      </span>,
    );
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push(text.slice(offset));
  // Keep plain and highlighted paragraphs on the same Satori inline layout
  // path, including when fallback fonts have different vertical metrics.
  return <span>{parts}</span>;
}

function TextBlock({ text, size = 15, style }: { text: string; size?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'block',
        boxSizing: 'border-box',
        width: '100%',
        minWidth: 0,
        fontSize: size,
        ...textStyle,
        lineHeight: 1.375,
        letterSpacing: '0.01em',
        ...style,
      }}
    >
      <InlineText text={text} />
    </div>
  );
}

function handleLine(post: PostSnapshot) {
  const handle = post.author?.handle ? '@' + post.author.handle.replace(/^@/, '') : undefined;
  return [handle, post.publishedAt].filter(Boolean).join(' · ');
}

function Header({
  post,
  assets,
  prefix,
  compact = false,
  reply = false,
}: {
  post: PostSnapshot;
  assets: TemplateContext['assets'];
  prefix: string;
  compact?: boolean;
  reply?: boolean;
}) {
  const { author } = post;
  const line = handleLine(post);
  if (!(author?.name || author?.handle || author?.avatarUrl || author?.verified || post.publishedAt)) return null;
  const size = compact ? 32 : 48;
  const avatar = assets[prefix + '-avatar'];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minHeight: reply && author?.avatarUrl ? size : undefined,
        gap: compact ? 8 : 12,
        marginBottom: compact ? 10 : reply ? 16 : 12,
      }}
    >
      {author?.avatarUrl && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            flexShrink: 0,
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundImage: 'linear-gradient(135deg, #dbeafe, #e0f2fe)',
            color: '#0e7490',
            fontSize: 14,
            fontWeight: 700,
            ...(reply ? { position: 'absolute', left: 0, top: 12 } : {}),
          }}
        >
          {avatar ? (
            <img src={avatar} width={size} height={size} style={{ objectFit: 'cover' }} />
          ) : (
            <span>
              {Array.from(author.name?.trim() ?? '')
                .slice(0, 2)
                .join('')
                .toUpperCase() || '?'}
            </span>
          )}
        </div>
      )}
      <div style={{ ...column, flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: 3 }}>
        {(author?.name || author?.verified) && (
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 5 }}>
            {author?.name && (
              <div
                style={{
                  display: 'flex',
                  minWidth: 0,
                  flexShrink: 1,
                  fontSize: compact ? 14 : reply ? 16 : 17,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {author.name}
              </div>
            )}
            {author?.verified && (
              <svg width={20} height={20} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path
                  fill={linkColor}
                  d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
                />
              </svg>
            )}
          </div>
        )}
        {line && (
          <div
            style={{
              display: 'flex',
              width: '100%',
              color: secondary,
              fontSize: compact ? 13 : 14,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {line}
          </div>
        )}
      </div>
    </div>
  );
}

function translationLabel(post: PostSnapshot) {
  const translation = post.translation;
  return (
    (translation?.model ? '使用 ' + translation.model + ' ' : '') +
    (translation?.sourceLanguage ? '翻译自 ' + translation.sourceLanguage : '翻译')
  );
}

function PostBody({
  post,
  assets,
  prefix,
  layout,
  compact = false,
  reply = false,
}: {
  post: PostSnapshot;
  assets: TemplateContext['assets'];
  prefix: string;
  layout?: MediaLayout;
  compact?: boolean;
  reply?: boolean;
}) {
  const translation = post.translation;
  return (
    <div style={column}>
      <Header post={post} assets={assets} prefix={prefix} compact={compact} reply={reply} />
      {post.content && (
        <TextBlock
          text={post.content}
          size={compact || reply ? 14 : 15}
          style={{ marginBottom: 12, lineHeight: compact ? 1.4 : 1.375 }}
        />
      )}
      {translation?.text && (
        <div style={{ ...column, marginBottom: 12 }}>
          <div
            style={{
              display: 'block',
              width: '100%',
              color: secondary,
              fontSize: 12,
              marginBottom: 8,
              ...textStyle,
              lineHeight: 1.4,
            }}
          >
            {translation.model && (
              <>
                <span>使用 </span>
                <span style={{ color: linkColor }}>{translation.model}</span>
                <span> </span>
              </>
            )}
            {translation.sourceLanguage ? (
              <>
                <span>翻译自 </span>
                <span style={{ color: linkColor }}>{translation.sourceLanguage}</span>
              </>
            ) : (
              '翻译'
            )}
          </div>
          <TextBlock
            text={translation.text}
            size={compact || reply ? 13 : 15}
            style={{
              padding: compact ? '10px 12px' : '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              backgroundColor: '#f6f7f8',
              color: '#4b5563',
            }}
          />
        </div>
      )}
      <MediaList media={post.media} layout={layout} assets={assets} prefix={prefix} />
    </div>
  );
}

function Footer({ source, url }: Pick<SocialPostData, 'source' | 'url'>) {
  const label = source?.trim();
  const address = url?.trim();
  if (!label && !address) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        width: '100%',
        borderTop: '1px solid #eef0f3',
        marginTop: 12,
        paddingTop: 10,
        color: '#9ca3af',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {label && (
        <div
          style={{
            display: 'flex',
            maxWidth: address ? '50%' : '100%',
            flexShrink: 0,
            padding: '1px 6px',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            backgroundColor: '#f6f7f8',
            color: secondary,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
      )}
      {label && address && <div style={{ display: 'flex', flexShrink: 0, margin: '0 5px' }}>·</div>}
      {address && (
        <div
          style={{
            display: 'flex',
            minWidth: 0,
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {address}
        </div>
      )}
    </div>
  );
}

function SocialPost({ data, assets }: { data: SocialPostData; assets: TemplateContext['assets'] }) {
  const replies = visibleReplies(data);
  return (
    <div style={{ ...column, color: '#0f1419' }}>
      {data.postKind === 'reshare' && data.reshare && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            color: secondary,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path
              fill={secondary}
              d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16V8c0-1.1-.896-2-2-2z"
            />
          </svg>
          <div style={{ display: 'flex', flexGrow: 1, minWidth: 0, ...textStyle }}>
            {data.reshare.by.name} 转发了{data.reshare.publishedAt && ' · ' + data.reshare.publishedAt}
          </div>
        </div>
      )}
      {replies.length > 0 && (
        <div style={{ ...column, marginBottom: 12 }}>
          {(data.replyChain?.length ?? 0) > 9 && (
            <div style={{ display: 'flex', color: linkColor, fontSize: 13, marginBottom: 12 }}>显示更多回复</div>
          )}
          {replies.map((post, index) => (
            <div key={index} style={{ ...column, position: 'relative', padding: '12px 0 12px 60px' }}>
              <div
                style={{
                  display: 'flex',
                  position: 'absolute',
                  left: 23,
                  top: 68,
                  bottom: -8,
                  width: 2,
                  backgroundColor: '#e5e7eb',
                }}
              />
              <PostBody post={post} prefix={'reply-' + index} assets={assets} layout={data.mediaLayout} reply />
            </div>
          ))}
        </div>
      )}
      <PostBody post={data} prefix="post" assets={assets} layout={data.mediaLayout} />
      {data.postKind === 'quote' && data.quotedPost && (
        <div
          style={{
            ...column,
            padding: '12px 16px',
            marginBottom: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            backgroundColor: '#fafbfc',
            overflow: 'hidden',
          }}
        >
          <PostBody post={data.quotedPost} prefix="quote" assets={assets} layout={data.mediaLayout} compact />
        </div>
      )}
      <Footer source={data.source} url={data.url} />
    </div>
  );
}

function Measure({ data }: { data: SocialPostData }) {
  const line = (text: string | undefined, size: number, weight = 400, inset = 0) =>
    text ? (
      <div
        data-measure
        style={{ display: 'flex', whiteSpace: 'pre', fontSize: size, fontWeight: weight, marginLeft: inset }}
      >
        {text}
      </div>
    ) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {postEntries(data).map(({ post, key, compact, reply }) => {
        const inset = reply ? 60 : compact ? 17 : 0;
        const headerInset = inset + (post.author?.avatarUrl && !reply ? (compact ? 40 : 60) : 0);
        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {line(
              post.author?.name,
              compact ? 14 : reply ? 16 : 17,
              700,
              headerInset + (post.author?.verified ? 25 : 0),
            )}
            {line(handleLine(post), compact ? 13 : 14, 400, headerInset)}
            {post.author?.avatarUrl && (
              <div data-measure style={{ display: 'flex', width: compact ? 32 : 48, height: 1, marginLeft: inset }} />
            )}
            {line(post.content, compact || reply ? 14 : 15, 400, inset)}
            {post.translation?.text && (
              <>
                {line(translationLabel(post), 12, 400, inset)}
                {line(post.translation.text, compact || reply ? 13 : 15, 400, inset + 13)}
              </>
            )}
          </div>
        );
      })}
      {data.postKind === 'reshare' &&
        data.reshare &&
        line(
          data.reshare.by.name + ' 转发了' + (data.reshare.publishedAt ? ' · ' + data.reshare.publishedAt : ''),
          13,
          400,
          25,
        )}
      {line([data.source?.trim(), data.url?.trim()].filter(Boolean).join(' · '), 12)}
    </div>
  );
}

export const socialPost: Template<SocialPostData> = {
  id: 'social_post',
  name: '社交动态',
  description: '跨平台社交内容，支持作者、译文、媒体、回复、引用和转发。',
  schema: socialPostSchema,
  sizing: { mode: 'content', minWidth: 400, maxWidth: 700 },
  mock: socialPostMock,
  assets: loadAssets,
  measure: data => <Measure data={data} />,
  render: (data, context) => <SocialPost data={data} assets={context.assets} />,
};
