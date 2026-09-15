import type { ReactNode } from 'react';

interface InlineTextProps {
  text: string;
}

const inlineTokenPattern =
  /(https?:\/\/[^\s]+|(?<![\p{L}\p{N}])#(?=[\p{L}\p{N}]*\p{L})[\p{L}\p{N}]+|@[\p{L}\p{N}_.-]+)/gu;

export function InlineText({ text }: InlineTextProps) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(inlineTokenPattern)) {
    const token = match[0];
    const start = match.index;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    if (token.startsWith('#')) {
      parts.push(
        <span className="card-content__hashtag" key={`${token}-${start}`}>
          {token}
        </span>,
      );
    } else if (token.startsWith('@')) {
      parts.push(
        <span className="card-content__mention" key={`${token}-${start}`}>
          {token}
        </span>,
      );
    } else {
      parts.push(
        <span className="card-content__link" key={`${token}-${start}`}>
          {token}
        </span>,
      );
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
