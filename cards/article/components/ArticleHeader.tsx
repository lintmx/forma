import styles from '../Card.module.css';

interface ArticleHeaderProps {
  title?: string;
  time?: string;
  authorName?: string;
}

/** 标题、作者与时间的阅读起点；没有标题时作者与时间仍单独成行。 */
export function ArticleHeader({ title, time, authorName }: ArticleHeaderProps) {
  const heading = title?.trim();
  const publishedAt = time?.trim();
  const author = authorName?.trim();
  const hasMeta = Boolean(author || publishedAt);
  const hasHeader = Boolean(heading || hasMeta);

  if (!hasHeader) {
    return null;
  }

  return (
    <header className={styles.header} data-has-title={heading ? 'true' : 'false'}>
      {heading && <h1 className={styles.title}>{heading}</h1>}
      {hasMeta && (
        <div className={styles.meta}>
          {author && <span className={styles.author}>{author}</span>}
          {author && publishedAt && <span className={styles.metaDot}>·</span>}
          {publishedAt && <time className={styles.time}>{publishedAt}</time>}
        </div>
      )}
    </header>
  );
}
