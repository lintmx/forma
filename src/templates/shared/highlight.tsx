import type { CSSProperties, ReactNode } from 'react';
import twitterText from 'twitter-text';

export const textHighlightColor = '#1d9bf0';

export interface TextRun {
  text: string;
  style?: CSSProperties;
  highlight?: boolean;
}

// Extract against the complete visible line, not each Markdown token: emphasis
// must not create fake boundaries inside emails, handles or hashtags.
export function highlightTextRuns(runs: TextRun[], { urls = false }: { urls?: boolean } = {}): ReactNode[] {
  let offset = 0;
  const positioned = runs.map(run => {
    const start = offset;
    offset += run.text.length;
    return { ...run, start, end: offset };
  });
  const text = runs.map(run => run.text).join('');
  const blocked = positioned.filter(run => run.highlight === false);
  let blockedIndex = 0;
  const ranges = twitterText.extractEntitiesWithIndices(text).flatMap(entity => {
    let [start, end] = entity.indices;
    if ('screenName' in entity) {
      // twitter-text 3.1.0 accepts 20-character names; X currently caps
      // handles at 15. Highlight the handle only when a list slug follows it.
      if (entity.screenName.length > 15) return [];
      end = start + 1 + entity.screenName.length;
    } else if ('url' in entity) {
      if (!urls || !/^https?:\/\//i.test(entity.url)) return [];
    } else if (!('hashtag' in entity)) return [];
    while (blocked[blockedIndex] && blocked[blockedIndex]!.end <= start) blockedIndex++;
    if (blocked[blockedIndex] && blocked[blockedIndex]!.start < end) return [];
    return [{ start, end }];
  });
  const nodes: ReactNode[] = [];
  let rangeIndex = 0;
  for (const run of positioned) {
    while (ranges[rangeIndex] && ranges[rangeIndex]!.end <= run.start) rangeIndex++;
    let cursor = run.start;
    const append = (end: number, highlighted = false) => {
      if (end <= cursor) return;
      nodes.push(
        <span key={cursor} style={highlighted ? { ...run.style, color: textHighlightColor } : run.style}>
          {text.slice(cursor, end)}
        </span>,
      );
      cursor = end;
    };
    for (let i = rangeIndex; ranges[i] && ranges[i]!.start < run.end; i++) {
      const range = ranges[i]!;
      append(Math.max(cursor, range.start));
      append(Math.min(run.end, range.end), true);
    }
    append(run.end);
  }
  return nodes;
}
