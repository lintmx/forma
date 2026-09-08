interface ContentProps {
  text?: string;
}

const inlineTokenPattern = /(https?:\/\/[^\s]+|#[\p{L}\p{N}_-]+|@[\p{L}\p{N}_.-]+)/gu;

function renderInlineText(text: string) {
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

export function Content({ text }: ContentProps) {
  if (!text) {
    return null;
  }

  return <div className="card-content">{renderInlineText(text)}</div>;
}
