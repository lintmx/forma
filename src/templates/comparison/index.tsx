import { diffWords } from 'diff';
import type { CSSProperties, ReactNode } from 'react';
import { colors, textStyle } from '../../core/card.js';
import type { Template, TemplateContext } from '../../core/types.js';
import { calculateMetricDelta, type DiffLine, diffLines, displayValue } from './comparison.js';
import { comparisonMock } from './mock.js';
import { type ComparisonData, type ComparisonModule, comparisonSchema } from './schema.js';

const column: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
};
const border = '1px solid ' + colors.border;
const tones = {
  green: { color: '#15803d', backgroundColor: '#f0fdf4' },
  red: { color: '#be123c', backgroundColor: '#fff1f2' },
  gray: { color: colors.muted, backgroundColor: '#f6f8fa' },
};
function Text({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'block', minWidth: 0, ...textStyle, ...style }}>{children}</div>;
}
function Empty({ children = '暂无可展示数据' }: { children?: ReactNode }) {
  return <Text style={{ padding: 18, textAlign: 'center', color: colors.muted }}>{children}</Text>;
}
function DiffText({ line }: { line: DiffLine }) {
  if (line.counterpart === undefined) return <span>{line.text || ' '}</span>;
  const before = line.kind === 'del' ? line.text : line.counterpart;
  const after = line.kind === 'add' ? line.text : line.counterpart;
  return (
    <span>
      {diffWords(before, after).map((change, index) => {
        if (line.kind === 'del' ? change.added : change.removed) return null;
        return (
          <span
            key={index}
            style={
              change.added || change.removed ? { backgroundColor: line.kind === 'del' ? '#fecdd3' : '#bbf7d0' } : {}
            }
          >
            {change.value}
          </span>
        );
      })}
    </span>
  );
}
function ModuleBody({ module, index, context }: { module: ComparisonModule; index: number; context: TemplateContext }) {
  const mono = context.monospaceFontFamily;
  switch (module.type) {
    case 'metric':
      return (
        <div style={column}>
          {module.items.length ? (
            module.items.map((item, i) => {
              const delta = calculateMetricDelta(item.before, item.after);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderTop: i ? border : undefined,
                  }}
                >
                  <Text style={{ color: colors.muted, flexShrink: 1 }}>{item.label?.trim() || '指标 ' + (i + 1)}</Text>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      minWidth: 0,
                      maxWidth: '75%',
                      gap: 8,
                      fontFamily: mono,
                    }}
                  >
                    <Text style={{ color: colors.muted, textDecoration: 'line-through' }}>
                      {displayValue(item.before)}
                    </Text>
                    <span style={{ color: colors.muted }}>→</span>
                    <Text style={{ fontSize: 14, fontWeight: 700 }}>{displayValue(item.after)}</Text>
                    {delta.label && (
                      <Text
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          ...tones[delta.trend === 'up' ? 'green' : delta.trend === 'down' ? 'red' : 'gray'],
                        }}
                      >
                        {delta.label}
                      </Text>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <Empty />
          )}
        </div>
      );
    case 'text':
      return (
        <div style={{ display: 'flex', padding: 12, gap: 10 }}>
          {(['before', 'after'] as const).map(side => (
            <div key={side} style={{ ...column, width: '50%', padding: '10px 12px', border, borderRadius: 8, gap: 6 }}>
              <Text style={{ fontSize: 11, color: side === 'after' ? '#2563eb' : colors.muted }}>
                {side === 'after' ? '更新后 · AFTER' : '更新前 · BEFORE'}
              </Text>
              <Text style={{ fontSize: 13 }}>{module[side] || '—'}</Text>
            </div>
          ))}
        </div>
      );
    case 'diff': {
      const lines = diffLines(module.before, module.after);
      return (
        <div style={{ ...column, fontSize: 13 }}>
          {lines.length ? (
            lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  padding: '6px 12px',
                  ...tones[line.kind === 'del' ? 'red' : line.kind === 'add' ? 'green' : 'gray'],
                }}
              >
                <span style={{ width: 20, flexShrink: 0, fontFamily: mono }}>
                  {line.kind === 'del' ? '−' : line.kind === 'add' ? '+' : ' '}
                </span>
                <Text style={{ flex: 1 }}>
                  <DiffText line={line} />
                </Text>
              </div>
            ))
          ) : (
            <Empty>前后均无内容</Empty>
          )}
        </div>
      );
    }
    case 'image':
      return (
        <div style={{ display: 'flex', padding: 12, gap: 12 }}>
          {(['before', 'after'] as const).map(side => {
            const source = context.assets[index + '-' + side];
            return (
              <div key={side} style={{ ...column, width: '50%', gap: 6 }}>
                <Text style={{ fontSize: 11, color: side === 'after' ? '#2563eb' : colors.muted }}>
                  {module[side].label?.trim() || (side === 'after' ? '更新后' : '更新前')}
                </Text>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 160,
                    width: '100%',
                    border: side === 'after' ? '1px solid #2563eb' : border,
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#f6f8fa',
                    color: colors.muted,
                  }}
                >
                  {source ? (
                    <img src={source} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{module[side].url ? '图片加载失败' : '暂无图片'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    case 'entity':
      return (
        <div style={column}>
          {module.items.length ? (
            module.items.map((entity, i) => (
              <div key={i} style={{ ...column, padding: '12px 14px', borderTop: i ? border : undefined, gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', flex: 1, gap: 8, minWidth: 0 }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: 700 }}>{entity.name.trim() || '未命名实体'}</Text>
                    {entity.handle?.trim() && (
                      <Text style={{ color: colors.muted, fontFamily: mono }}>{entity.handle.trim()}</Text>
                    )}
                  </div>
                  <Text
                    style={{ maxWidth: '45%', padding: '6px 10px', borderRadius: 18, ...tones[entity.color ?? 'gray'] }}
                  >
                    {entity.action.trim() || '—'}
                  </Text>
                </div>
                {entity.bio?.trim() && (
                  <Text style={{ padding: '10px 12px', border, borderRadius: 8, fontSize: 13 }}>
                    {entity.bio.trim()}
                  </Text>
                )}
              </div>
            ))
          ) : (
            <Empty>暂无实体变更</Empty>
          )}
        </div>
      );
  }
}
export const comparison: Template<ComparisonData> = {
  id: 'comparison',
  name: '数据对比',
  description: '指标增减、文本前后对照、逐行与词级差异、图片及实体列表变更。',
  schema: comparisonSchema,
  sizing: { mode: 'auto-height', width: 600 },
  mock: comparisonMock,
  assets: async (data, images) => {
    const entries = await Promise.all(
      data.modules.flatMap((module, index) =>
        module.type === 'image'
          ? (['before', 'after'] as const)
              .filter(side => module[side].url)
              .map(
                async side => [index + '-' + side, await images.get(module[side].url).catch(() => undefined)] as const,
              )
          : [],
      ),
    );
    return Object.fromEntries(entries);
  },
  render: (data, context) => (
    <div style={{ ...column, fontSize: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 14,
          borderBottom: border,
        }}
      >
        <div style={{ ...column, flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: 700 }}>{data.title.trim() || '数据对比'}</Text>
          {data.subtitle?.trim() && <Text style={{ marginTop: 4, color: colors.muted }}>{data.subtitle.trim()}</Text>}
        </div>
        {data.time?.trim() && (
          <Text
            style={{
              maxWidth: '42%',
              padding: '4px 8px',
              border,
              borderRadius: 6,
              ...tones.gray,
              fontFamily: context.monospaceFontFamily,
            }}
          >
            {data.time.trim()}
          </Text>
        )}
      </div>
      <div style={{ ...column, gap: 16, marginTop: 16 }}>
        {data.modules.map((module, index) => (
          <div key={index} style={{ ...column, border, borderRadius: 12, overflow: 'hidden' }}>
            {module.name?.trim() && (
              <Text
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  backgroundColor: '#f6f8fa',
                  borderBottom: border,
                }}
              >
                {module.name.trim()}
              </Text>
            )}
            <ModuleBody module={module} index={index} context={context} />
          </div>
        ))}
      </div>
    </div>
  ),
};
