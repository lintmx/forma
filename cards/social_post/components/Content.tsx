import { InlineText } from './InlineText';

interface ContentProps {
  text?: string;
}

export function Content({ text }: ContentProps) {
  if (!text) {
    return null;
  }

  return (
    <div className="card-content">
      <InlineText text={text} />
    </div>
  );
}
