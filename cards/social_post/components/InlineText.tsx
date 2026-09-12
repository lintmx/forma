interface InlineTextProps {
  text: string;
}

const inlineTokenPattern = /(https?:\/\/[^\s]+|#[\p{L}\p{N}_-]+|@[\p{L}\p{N}_.-]+)/gu;

export function InlineText({ text }: InlineTextProps) {
  return text.split(inlineTokenPattern).map((part, index) => {
    if (part.startsWith('#')) {
      return (
        <span className="card-content__hashtag" key={`${part}-${index}`}>
          {part}
        </span>
      );
    }

    if (part.startsWith('@')) {
      return (
        <span className="card-content__mention" key={`${part}-${index}`}>
          {part}
        </span>
      );
    }

    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <span className="card-content__link" key={`${part}-${index}`}>
          {part}
        </span>
      );
    }

    return part;
  });
}
