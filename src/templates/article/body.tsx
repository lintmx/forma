import { decodeHTML } from 'entities';
import { type MarkedToken, marked, type Token } from 'marked';
import type { CSSProperties, ReactNode } from 'react';
import { colors, textStyle } from '../../core/card.js';
import type { ImageStore } from '../../core/images.js';
import type { TemplateContext } from '../../core/types.js';
import { highlightTextRuns, type TextRun, textHighlightColor } from '../shared/highlight.js';
import type { ArticleData } from './schema.js';

export const column: CSSProperties = {
  display: 'flex',
  boxSizing: 'border-box',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
};
const paragraph: CSSProperties = {
  display: 'block',
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  ...textStyle,
};
const lexer = (text: string) => marked.lexer(text, { gfm: true, breaks: true });

export async function loadArticleImages(data: ArticleData, images: ImageStore) {
  const urls = new Set<string>();
  if (data.authorAvatarUrl) urls.add(data.authorAvatarUrl);
  for (const [text, format] of [
    [data.content, data.contentFormat],
    [data.translation?.text, data.translation?.format],
  ]) {
    if (!text || format === 'text') continue;
    marked.walkTokens(lexer(text), token => {
      if (token.type === 'image') urls.add(decodeHTML(token.href));
    });
  }
  const assets: TemplateContext['assets'] = Object.create(null);
  // Load through the existing bounded, SSRF-protected store, never from Satori.
  for (const url of urls) assets[url] = await images.get(url).catch(() => undefined);
  return assets;
}

type InlinePart = TextRun | { image: string; alt: string };
function inlineParts(
  tokens: Token[],
  context: TemplateContext,
  style: CSSProperties = {},
  highlight = true,
): InlinePart[] {
  return tokens.flatMap((raw): InlinePart[] => {
    const token = raw as MarkedToken;
    switch (token.type) {
      case 'image':
        return [{ image: decodeHTML(token.href), alt: decodeHTML(token.text) }];
      case 'strong':
        return inlineParts(token.tokens, context, { ...style, fontWeight: 700 }, highlight);
      case 'em':
        return inlineParts(token.tokens, context, { ...style, fontStyle: 'italic' }, highlight);
      case 'del':
        return inlineParts(token.tokens, context, { ...style, textDecoration: 'line-through' }, highlight);
      case 'link':
        return inlineParts(token.tokens, context, { ...style, color: textHighlightColor }, false);
      case 'codespan':
        return [
          {
            text: token.text,
            style: { ...style, fontFamily: context.monospaceFontFamily, backgroundColor: '#f1f3f5' },
            highlight: false,
          },
        ];
      case 'br':
        return [{ text: '\n' }];
      case 'html':
        return []; // Raw HTML never becomes layout or remote resources.
      case 'text':
        if (token.tokens) return inlineParts(token.tokens, context, style, highlight);
        return [{ text: decodeHTML(token.text), style, highlight }];
      case 'escape':
        return [{ text: token.text, style, highlight: false }];
      default:
        return [];
    }
  });
}

function Inline({ tokens, context }: { tokens: Token[]; context: TemplateContext }) {
  const blocks: ReactNode[] = [];
  let run: TextRun[] = [];
  const flush = () => {
    if (run.length)
      blocks.push(
        <div key={blocks.length} style={paragraph}>
          <span>{highlightTextRuns(run)}</span>
        </div>,
      );
    run = [];
  };
  for (const part of inlineParts(tokens, context)) {
    if ('text' in part) run.push(part);
    else {
      flush();
      const source = context.assets[part.image];
      blocks.push(
        source ? (
          <img
            key={blocks.length}
            src={source}
            style={{ maxWidth: '100%', objectFit: 'contain', marginTop: 6, marginBottom: 6 }}
          />
        ) : (
          <div
            key={blocks.length}
            style={{ ...paragraph, color: colors.muted, padding: 10, backgroundColor: '#f6f8fa' }}
          >
            {part.alt ? '图片加载失败：' + part.alt : '图片加载失败'}
          </div>
        ),
      );
    }
  }
  flush();
  return <div style={column}>{blocks}</div>;
}

function Blocks({ tokens, context }: { tokens: Token[]; context: TemplateContext }) {
  return (
    <div style={{ ...column, gap: 12 }}>
      {tokens.map((raw, index) => {
        const token = raw as MarkedToken;
        switch (token.type) {
          case 'space':
          case 'def':
          case 'html':
            return null;
          case 'paragraph':
          case 'text':
            return <Inline key={index} tokens={token.tokens ?? [token]} context={context} />;
          case 'heading':
            return (
              <div
                key={index}
                style={{
                  ...column,
                  fontWeight: 700,
                  fontSize: [28, 24, 21, 19, 17, 16][token.depth - 1],
                  marginTop: 4,
                }}
              >
                <Inline tokens={token.tokens} context={context} />
              </div>
            );
          case 'hr':
            return <div key={index} style={{ width: '100%', height: 1, backgroundColor: colors.border }} />;
          case 'blockquote':
            return (
              <div
                key={index}
                style={{ ...column, borderLeft: '3px solid #cbd5e1', padding: '4px 14px', color: colors.muted }}
              >
                <Blocks tokens={token.tokens} context={context} />
              </div>
            );
          case 'code':
            return (
              <div
                key={index}
                style={{
                  ...column,
                  padding: 12,
                  backgroundColor: '#f6f8fa',
                  borderRadius: 6,
                  fontFamily: context.monospaceFontFamily,
                  fontSize: 14,
                }}
              >
                <div style={paragraph}>{token.text}</div>
              </div>
            );
          case 'list':
            return (
              <div key={index} style={{ ...column, gap: 8 }}>
                {token.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', width: '100%', gap: 8 }}>
                    <div style={{ ...textStyle, flexShrink: 0, minWidth: 24 }}>
                      {item.task ? (item.checked ? '[x]' : '[ ]') : token.ordered ? Number(token.start) + i + '.' : '•'}
                    </div>
                    <div style={{ ...column, flex: 1 }}>
                      <Blocks tokens={item.tokens} context={context} />
                    </div>
                  </div>
                ))}
              </div>
            );
          case 'table':
            return (
              <div key={index} style={{ ...column, border: '1px solid ' + colors.border, fontSize: 14 }}>
                {[token.header, ...token.rows].map((row, r) => (
                  <div
                    key={r}
                    style={{
                      display: 'flex',
                      width: '100%',
                      backgroundColor: r === 0 ? '#f6f8fa' : undefined,
                      fontWeight: r === 0 ? 700 : 400,
                      borderTop: r ? '1px solid ' + colors.border : undefined,
                    }}
                  >
                    {row.map((cell, c) => (
                      <div
                        key={c}
                        style={{
                          ...column,
                          width: 100 / row.length + '%',
                          padding: 8,
                          borderLeft: c ? '1px solid ' + colors.border : undefined,
                          textAlign: cell.align ?? 'left',
                        }}
                      >
                        <Inline tokens={cell.tokens} context={context} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function ArticleBody({
  text,
  format,
  context,
}: {
  text: string;
  format?: 'markdown' | 'text';
  context: TemplateContext;
}) {
  return format === 'text' ? (
    <div style={paragraph}>
      <span>{highlightTextRuns([{ text }])}</span>
    </div>
  ) : (
    <Blocks tokens={lexer(text)} context={context} />
  );
}
