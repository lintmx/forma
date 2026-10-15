import { decodeHTML } from 'entities';
import { type MarkedToken, marked, type Token, type Tokens } from 'marked';
import type { CSSProperties, ReactNode } from 'react';
import type { ImageStore } from '../../core/images.js';
import type { TemplateContext } from '../../core/types.js';
import { colors, markdownHeading, proseSpacing, textStyle, typography } from '../../core/typography.js';
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
  // Load through the existing bounded image store, never from Satori.
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
        return inlineParts(
          token.tokens,
          context,
          { ...style, textDecoration: [style.textDecoration, 'line-through'].filter(Boolean).join(' ') },
          highlight,
        );
      case 'link':
        return inlineParts(
          token.tokens,
          context,
          {
            ...style,
            color: textHighlightColor,
            textDecoration: [style.textDecoration, 'underline'].filter(Boolean).join(' '),
          },
          false,
        );
      case 'codespan':
        return [
          {
            text: token.text,
            style: { ...style, fontFamily: context.monospaceFontFamily, fontSize: '0.9em', backgroundColor: '#f1f3f5' },
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

function CodeBlock({ text, context }: { text: string; context: TemplateContext }) {
  const lines = text.split('\n');
  return (
    <div
      style={{
        ...column,
        padding: 12,
        borderRadius: 6,
        backgroundColor: colors.surface,
        ...typography.code,
        fontFamily: context.monospaceFontFamily,
      }}
    >
      {lines.map((line, index) => (
        <div key={index} style={{ display: 'flex', width: '100%', minWidth: 0, alignItems: 'baseline', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              flexShrink: 0,
              width: Math.max(2, String(lines.length).length) * typography.code.fontSize * 0.6,
              color: colors.muted,
            }}
          >
            {index + 1}
          </div>
          <div style={{ ...paragraph, flex: 1, width: undefined }}>{line.replace(/\t/g, '    ') || '\u00a0'}</div>
        </div>
      ))}
    </div>
  );
}

// Use visible text demand only to distribute the available table width. Actual
// glyph layout/wrapping remains Satori's job; a long URL cannot monopolize it.
function cellDemand(cell: Tokens.TableCell, context: TemplateContext) {
  const text = inlineParts(cell.tokens, context)
    .map(part => ('text' in part ? part.text : part.alt))
    .join('');
  const length = Array.from(text).reduce((sum, char) => sum + (char.codePointAt(0)! > 255 ? 2 : 1), 0);
  return Math.max(8, Math.min(32, length));
}

function MarkdownTable({ token, context }: { token: Tokens.Table; context: TemplateContext }) {
  // More than four columns becomes labeled records instead of unreadably narrow
  // cells. All values and their column headings remain present in the image.
  if (token.header.length > 4) {
    return (
      <div style={{ ...column, ...typography.compact, gap: 12 }}>
        {(token.rows.length ? token.rows : [[]]).map((row, r) => (
          <div key={r} style={{ ...column, border: '1px solid ' + colors.border, borderRadius: 6 }}>
            <div
              style={{
                ...column,
                ...typography.meta,
                padding: 8,
                color: colors.muted,
                backgroundColor: colors.surface,
              }}
            >
              {token.rows.length ? '记录 ' + (r + 1) : '表头'}
            </div>
            {token.header.map((header, c) => (
              <div key={c} style={{ ...column, gap: 4, padding: 10, borderTop: '1px solid ' + colors.border }}>
                <div style={{ ...column, fontWeight: 700 }}>
                  <Inline tokens={header.tokens} context={context} />
                </div>
                <Inline tokens={row[c]?.tokens ?? []} context={context} />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  const demands = token.header.map((cell, c) =>
    Math.max(cellDemand(cell, context), ...token.rows.map(row => (row[c] ? cellDemand(row[c]!, context) : 8))),
  );
  const total = demands.reduce((sum, value) => sum + value, 0);
  return (
    <div style={{ ...column, border: '1px solid ' + colors.border, ...typography.compact }}>
      {[token.header, ...token.rows].map((row, r) => (
        <div
          key={r}
          style={{
            display: 'flex',
            width: '100%',
            backgroundColor: r === 0 ? colors.surface : undefined,
            fontWeight: r === 0 ? 700 : 400,
            borderTop: r ? '1px solid ' + colors.border : undefined,
          }}
        >
          {row.map((cell, c) => (
            <div
              key={c}
              style={{
                ...column,
                width: (100 * demands[c]!) / total + '%',
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
}

function Blocks({ tokens, context, tight = false }: { tokens: Token[]; context: TemplateContext; tight?: boolean }) {
  return (
    <div style={{ ...column, gap: tight ? 4 : proseSpacing.paragraph }}>
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
                  ...markdownHeading(token.depth),
                  marginTop: index === 0 ? 0 : proseSpacing.headingBefore - proseSpacing.paragraph,
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
                style={{
                  ...column,
                  borderLeft: '3px solid #cbd5e1',
                  padding: '4px 16px',
                  color: colors.ink,
                  backgroundColor: colors.surface,
                }}
              >
                <Blocks tokens={token.tokens} context={context} />
              </div>
            );
          case 'code':
            return <CodeBlock key={index} text={token.text} context={context} />;
          case 'list':
            return (
              <div key={index} style={{ ...column, gap: proseSpacing.listItem }}>
                {token.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', width: '100%', gap: 8 }}>
                    <div style={{ ...textStyle, flexShrink: 0, minWidth: proseSpacing.indent, textAlign: 'right' }}>
                      {item.task ? (item.checked ? '[x]' : '[ ]') : token.ordered ? Number(token.start) + i + '.' : '•'}
                    </div>
                    <div style={{ ...column, flex: 1 }}>
                      <Blocks tokens={item.tokens} context={context} tight={!token.loose} />
                    </div>
                  </div>
                ))}
              </div>
            );
          case 'table':
            return <MarkdownTable key={index} token={token} context={context} />;
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
