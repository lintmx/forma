import { useEffect, useState } from 'react';
import type { CardAuthor } from '../../../src/types/card';

interface AvatarProps {
  author: CardAuthor;
}

function getInitials(name?: string): string {
  return name?.trim().slice(0, 2).toUpperCase() || '?';
}

export function Avatar({ author }: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [author.avatarUrl]);

  return (
    <div className="card-avatar" aria-hidden="true">
      {author.avatarUrl && !hasError ? (
        <img
          src={author.avatarUrl}
          alt=""
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <span>{getInitials(author.name)}</span>
      )}
    </div>
  );
}
