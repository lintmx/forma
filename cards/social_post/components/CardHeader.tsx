import type { CardAuthor } from '../../../src/types/card';
import { Author } from './Author';

interface CardHeaderProps {
  author?: CardAuthor;
  compact?: boolean;
  publishedAt?: string;
}

export function CardHeader({ author, compact = false, publishedAt }: CardHeaderProps) {
  const hasAuthor = Boolean(
    author?.name || author?.handle || author?.avatarUrl || author?.verified,
  );

  if (!hasAuthor && !publishedAt) {
    return null;
  }

  return (
    <header className={`card-header${compact ? ' card-header--compact' : ''}`}>
      <Author author={author} publishedAt={publishedAt} />
    </header>
  );
}
