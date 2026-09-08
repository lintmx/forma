import type { ReactNode } from 'react';
import type { CardType } from '../../../src/types/card';

interface CardContainerProps {
  type: CardType;
  className?: string;
  children: ReactNode;
}

export function CardContainer({ type, className, children }: CardContainerProps) {
  return (
    <article
      className={['card-container', className].filter(Boolean).join(' ')}
      data-card-type={type}
    >
      <div className="card-surface">{children}</div>
    </article>
  );
}
