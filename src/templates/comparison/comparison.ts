import { type Change, diffLines as calculateLineDiff } from 'diff';

type MetricTrend = 'up' | 'down' | 'neutral';

interface ParsedMetric {
  number: number;
  prefix: string;
  suffix: string;
  decimals: number;
}

interface MetricDelta {
  label: string | null;
  trend: MetricTrend;
}

const metricPattern = /^([^\d+-]*)([+-]?\d[\d,]*(?:\.\d+)?)(.*)$/u;

function parseMetric(value: unknown): ParsedMetric | null {
  const text = String(value ?? '').trim();
  const match = text.match(metricPattern);
  if (!match) {
    return null;
  }

  const numberText = match[2]!.replaceAll(',', '');
  const number = Number(numberText);
  if (!Number.isFinite(number)) {
    return null;
  }

  const decimalPart = numberText.split('.')[1];
  return {
    number,
    prefix: match[1]!,
    suffix: match[3]!,
    decimals: decimalPart?.length ?? 0,
  };
}

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function calculateMetricDelta(before: unknown, after: unknown): MetricDelta {
  const beforeMetric = parseMetric(before);
  const afterMetric = parseMetric(after);
  if (!beforeMetric || !afterMetric) {
    return { label: null, trend: 'neutral' };
  }

  const difference = afterMetric.number - beforeMetric.number;
  const normalizedDifference = Object.is(difference, -0) ? 0 : difference;
  const trend: MetricTrend = normalizedDifference > 0 ? 'up' : normalizedDifference < 0 ? 'down' : 'neutral';
  const sign = normalizedDifference > 0 ? '+' : normalizedDifference < 0 ? '-' : '';
  const prefix = beforeMetric.prefix === afterMetric.prefix ? afterMetric.prefix : '';
  const suffix = beforeMetric.suffix === afterMetric.suffix ? afterMetric.suffix : '';
  const decimals = Math.max(beforeMetric.decimals, afterMetric.decimals);
  const label = `${sign}${prefix}${formatNumber(Math.abs(normalizedDifference), decimals)}${suffix}`;

  return { label, trend };
}

type DiffLineKind = 'del' | 'add' | 'same';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  counterpart?: string;
}

function splitDiffChunk(value: string): string[] {
  const lines = value.replace(/\r\n?/gu, '\n').split('\n');
  if (lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
}

function toDiffLines(change: Change): DiffLine[] {
  const kind: DiffLineKind = change.removed ? 'del' : change.added ? 'add' : 'same';
  return splitDiffChunk(change.value).map(text => ({ kind, text }));
}

function pairChangedLines(lines: DiffLine[]): DiffLine[] {
  const pairedLines = lines.map(line => ({ ...line }));
  let index = 0;

  while (index < pairedLines.length) {
    if (pairedLines[index]!.kind === 'same') {
      index += 1;
      continue;
    }

    const deletedIndexes: number[] = [];
    const addedIndexes: number[] = [];
    while (index < pairedLines.length && pairedLines[index]!.kind !== 'same') {
      if (pairedLines[index]!.kind === 'del') {
        deletedIndexes.push(index);
      } else {
        addedIndexes.push(index);
      }
      index += 1;
    }

    const pairCount = Math.min(deletedIndexes.length, addedIndexes.length);
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const deletedLine = pairedLines[deletedIndexes[pairIndex]!]!;
      const addedLine = pairedLines[addedIndexes[pairIndex]!]!;
      deletedLine.counterpart = addedLine.text;
      addedLine.counterpart = deletedLine.text;
    }
  }

  return pairedLines;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const changes = calculateLineDiff(before.replace(/\r\n?/gu, '\n'), after.replace(/\r\n?/gu, '\n'), {
    oneChangePerToken: true,
  });
  return pairChangedLines(changes.flatMap(toDiffLines));
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}
