import type { Template } from '../../core/types.js';
import { colors, textStyle, typography } from '../../core/typography.js';
import { MediaList } from '../shared/media.js';
import { SourceFooter } from '../shared/source-footer.js';
import { ArticleBody, column, loadArticleImages } from './body.js';
import { articleMock } from './mock.js';
import { type ArticleData, articleSchema } from './schema.js';

export const article: Template<ArticleData> = {
  id: 'article',
  name: '文章',
  description: '正文必填，支持 Markdown 与纯文本；可选标题、作者及头像、时间、译文、图片、来源和原文链接。',
  schema: articleSchema,
  sizing: { mode: 'auto-height', width: 700 },
  mock: articleMock,
  assets: loadArticleImages,
  render: (data, context) => {
    const translation = data.translation;
    const hasTranslation =
      translation &&
      [translation.title, translation.text, translation.model, translation.sourceLanguage].some(value => value?.trim());
    const byline = [data.author?.trim(), data.publishedAt?.trim()].filter(Boolean).join(' · ');
    const avatar = data.authorAvatarUrl ? context.assets[data.authorAvatarUrl] : undefined;
    return (
      <div style={{ ...column, ...typography.prose, ...textStyle }}>
        <div style={{ ...column, gap: 18 }}>
          {Boolean(data.title?.trim()) && <div style={{ display: 'block', ...typography.title }}>{data.title}</div>}
          {Boolean(byline || data.authorAvatarUrl) && (
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, gap: 10 }}>
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
              {Boolean(byline) && (
                <div style={{ display: 'block', minWidth: 0, flex: 1, ...typography.meta, color: colors.muted }}>
                  {byline}
                </div>
              )}
            </div>
          )}
          <ArticleBody text={data.content} format={data.contentFormat} context={context} />
          {hasTranslation && (
            <div
              style={{
                ...column,
                gap: 12,
                padding: 16,
                border: '1px solid ' + colors.border,
                borderRadius: 8,
                backgroundColor: '#f8fafb',
              }}
            >
              <div style={{ display: 'block', color: colors.muted, ...typography.meta }}>
                {(translation.model?.trim() ? '使用 ' + translation.model.trim() + ' · ' : '') +
                  (translation.sourceLanguage?.trim() ? '翻译自 ' + translation.sourceLanguage.trim() : '翻译')}
              </div>
              {Boolean(translation.title?.trim()) && (
                <div style={{ display: 'block', ...typography.heading }}>{translation.title}</div>
              )}
              {Boolean(translation.text?.trim()) && (
                <ArticleBody text={translation.text!} format={translation.format} context={context} />
              )}
            </div>
          )}
          <MediaList media={data.media} layout={data.mediaLayout} assets={context.assets} prefix="article" />
        </div>
        <SourceFooter source={data.source} url={data.url} marginTop={data.media?.length ? 0 : 12} />
      </div>
    );
  },
};
