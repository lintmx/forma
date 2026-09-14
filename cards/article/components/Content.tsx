import type { ArticleCardContent } from '../../../src/generated/types';
import { MarkdownContent } from './MarkdownContent';
import styles from '../Card.module.css';

type ArticleContentType = NonNullable<ArticleCardContent['contentType']>;

interface ArticleContentProps {
  text: string;
  contentType?: ArticleContentType;
  compact?: boolean;
}

/** 根据字段类型渲染 Article 正文；未提供类型时保持 Markdown 的默认行为。 */
export function ArticleContent({
  text,
  contentType = 'markdown',
  compact = false,
}: ArticleContentProps) {
  if (contentType === 'text') {
    const className = compact ? `${styles.plainText} ${styles.plainTextCompact}` : styles.plainText;
    return <div className={className}>{text}</div>;
  }

  return <MarkdownContent text={text} compact={compact} />;
}
