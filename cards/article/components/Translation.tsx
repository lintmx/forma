import type { ArticleCardContent } from '../../../src/generated/types';
import { ArticleContent } from './Content';
import styles from '../Card.module.css';

interface TranslationProps {
  translation: NonNullable<ArticleCardContent['translation']>;
}

/** 译文区域沿用公共译文样式，正文按自身类型渲染并与原文区分。 */
export function Translation({ translation }: TranslationProps) {
  const title = translation.title?.trim();
  const content = translation.content?.trim();
  const contentType = translation.contentType ?? 'markdown';
  const sourceLanguage = translation.sourceLanguage?.trim();
  const model = translation.model?.trim();
  const directionLabel = sourceLanguage ? '翻译自' : '翻译';

  if (!title && !content) {
    return null;
  }

  return (
    <aside className="card-translation" aria-label="翻译">
      <div className="card-translation__label">
        {model && (
          <>
            使用 <span className="translation-model">{model}</span>{' '}
          </>
        )}
        {directionLabel}
        {sourceLanguage && (
          <>
            {' '}
            <span className="translation-language">{sourceLanguage}</span>
          </>
        )}
      </div>
      <div className={['card-translation__text', styles.translationText].join(' ')}>
        {title && <div className={styles.translationTitle}>{title}</div>}
        {content && <ArticleContent text={content} contentType={contentType} compact />}
      </div>
    </aside>
  );
}
