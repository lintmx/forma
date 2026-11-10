import type { Node, Renderer, RenderOptions } from '@takumi-rs/core';
import type { Config } from '../config.js';
import { FormaError } from './errors.js';
import type { SizeStrategy } from './types.js';

export function assertDimensions(
  width: number,
  height: number,
  config: Pick<Config, 'maxWidth' | 'maxHeight' | 'maxPixels'>,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > config.maxWidth ||
    height > config.maxHeight ||
    width * height > config.maxPixels
  ) {
    throw new FormaError('SIZE_LIMIT', 'Rendered dimensions exceed configured limits', 422, {
      width,
      height,
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      maxPixels: config.maxPixels,
    });
  }
}

export async function layoutOptions(
  strategy: SizeStrategy,
  node: Node,
  renderer: Renderer,
  options: RenderOptions,
  config: Config,
) {
  let width: number | undefined;
  let height: number | undefined;
  if (strategy.mode === 'fixed' || strategy.mode === 'auto-height') width = strategy.width * 2;
  if (strategy.mode === 'fixed' || strategy.mode === 'auto-width') height = strategy.height * 2;
  assertDimensions(width ?? 1, height ?? 1, config);
  if (strategy.mode === 'content') {
    if (strategy.minWidth > strategy.maxWidth) throw new Error('Invalid content sizing strategy');
    assertDimensions(strategy.minWidth * 2, 1, config);
    node.style = {
      ...node.style,
      width: 'max-content',
      minWidth: strategy.minWidth,
      maxWidth: Math.min(strategy.maxWidth, Math.floor(config.maxWidth / 2)),
    };
    const measured = await renderer.measure(node, options);
    width = Math.ceil(measured.width / 2) * 2;
    node.style = { ...node.style, width: width / 2 };
  }
  if (width === undefined || height === undefined) {
    const measured = await renderer.measure(node, { ...options, width, height });
    width ??= Math.ceil(measured.width / 2) * 2;
    height ??= Math.ceil(measured.height / 2) * 2;
  }
  assertDimensions(width, height, config);
  return { width, height };
}

// Tables declare their available content width, including nested list/quote insets.
// Measure the actual cells once; wide tables reuse those cells as labeled records.
export async function fitTables(node: Node, renderer: Renderer, options: RenderOptions): Promise<void> {
  if (node.type !== 'container') return;
  const available = Number(node.attributes?.['data-forma-table-width']);
  if (node.tagName === 'table' && available > 0) {
    const measured = await renderer.measure(node, { ...options, width: available * 2 });
    if (measured.width > available * 2 + 1) {
      const rows = node.children?.[0];
      if (rows?.type !== 'container') return;
      const header = rows.children?.[0];
      if (header?.type !== 'container') return;
      const records = rows.children!.slice(1);
      node.tagName = 'div';
      node.preset = undefined;
      node.style = { ...node.style, display: 'flex', flexDirection: 'column', gap: 12 };
      node.children = (records.length ? records : [header]).map(row => ({
        type: 'container',
        style: { display: 'flex', flexDirection: 'column' },
        children:
          row.type === 'container'
            ? (row.children ?? []).map((cell, index) => ({
                type: 'container',
                style: { padding: '10px 12px', borderTop: '0.5px solid #e3e8ee' },
                children: [
                  {
                    type: 'container',
                    style: { fontWeight: 700, marginBottom: 4 },
                    children: header.children?.[index]?.type === 'container' ? header.children[index].children : [],
                  },
                  ...(records.length && cell.type === 'container' ? (cell.children ?? []) : []),
                ],
              }))
            : [],
      }));
    }
    return;
  }
  for (const child of node.children ?? []) await fitTables(child, renderer, options);
}
