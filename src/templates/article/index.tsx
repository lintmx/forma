import type { Template } from '../../core/types.js';
import { colors, textStyle, typography } from '../../core/typography.js';
import { MediaList } from '../shared/media.js';
import { SourceFooter } from '../shared/source-footer.js';
import { ArticleBody, column, loadArticleImages } from './body.js';
import { articleMock } from './mock.js';
import { articlePresets } from './presets.js';
import { type ArticleData, articleSchema } from './schema.js';

export const article: Template<ArticleData> = {
  id: 'article',
  name: '文章',
  description: '正文必填，支持 Markdown 与纯文本；可选标题、作者及头像、时间、译文、图片、来源和原文链接。',
  schema: articleSchema,
  sizing: { mode: 'auto-height', width: 700 },
  mock: articleMock,
  presets: articlePresets,
  assets: loadArticleImages,
  render: (data, context) => {
    const translation = data.translation;
    const hasTranslation =
      translation &&
      [translation.title, translation.text, translation.model, translation.sourceLanguage].some(value => value?.trim());
    const author = data.author?.trim();
    const publishedAt = data.publishedAt?.trim();
    const hasHeader = Boolean(data.title?.trim() || author || publishedAt || data.authorAvatarUrl);
    const avatar = data.authorAvatarUrl ? context.assets[data.authorAvatarUrl] : undefined;
    return (
      <div style={{ ...column, ...typography.prose, ...textStyle, lineHeight: 1.8 }}>
        <div style={{ ...column, gap: 28 }}>
          {hasHeader && (
            <div style={{ ...column, gap: 20, paddingBottom: 24, borderBottom: '0.5px solid ' + colors.border }}>
              {Boolean(data.title?.trim()) && (
                <div
                  style={{ display: 'block', ...typography.title, fontSize: 32, lineHeight: 1.3, letterSpacing: -0.6 }}
                >
                  {data.title}
                </div>
              )}
              {Boolean(author || publishedAt || data.authorAvatarUrl) && (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, gap: 12 }}>
                  {Boolean(data.authorAvatarUrl) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: '#eef2f6',
                        color: colors.muted,
                        ...typography.meta,
                        fontWeight: 700,
                      }}
                    >
                      {avatar ? (
                        <img src={avatar} width={36} height={36} style={{ objectFit: 'cover' }} />
                      ) : (
                        <span>
                          {Array.from(data.author?.trim() ?? '')
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                  )}
                  {Boolean(author || publishedAt) && (
                    <div style={{ ...column, flex: 1, gap: 3, ...typography.meta }}>
                      {author && <div style={{ display: 'block', fontWeight: 700 }}>{author}</div>}
                      {publishedAt && <div style={{ display: 'block', color: colors.muted }}>{publishedAt}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <ArticleBody text={data.content} format={data.contentFormat} context={context} />
          {hasTranslation && (
            <div
              style={{
                ...column,
                gap: 16,
                paddingTop: 20,
                borderTop: '0.5px solid ' + colors.border,
              }}
            >
              <div style={{ display: 'block', width: '100%', ...typography.meta, color: colors.muted, ...textStyle }}>
                {Boolean(translation.model?.trim()) && (
                  <>
                    <span>使用 </span>
                    <span style={{ color: colors.link }}>{translation.model?.trim()}</span>
                    <span> </span>
                  </>
                )}
                {translation.sourceLanguage?.trim() ? (
                  <>
                    <span>翻译自 </span>
                    <span style={{ color: colors.link }}>{translation.sourceLanguage.trim()}</span>
                  </>
                ) : (
                  '翻译'
                )}
              </div>
              {Boolean(translation.title?.trim()) && (
                <div style={{ display: 'block', ...typography.body, fontWeight: 700 }}>{translation.title}</div>
              )}
              {Boolean(translation.text?.trim()) && (
                <ArticleBody text={translation.text!} format={translation.format} context={context} />
              )}
            </div>
          )}
          <MediaList media={data.media} layout={data.mediaLayout} assets={context.assets} prefix="article" />
        </div>
        <SourceFooter source={data.source} url={data.url} marginTop={data.media?.length ? 12 : 28} />
      </div>
    );
  },
};
