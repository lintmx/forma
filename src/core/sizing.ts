import type { ReactNode } from 'react';
import satori, { type SatoriOptions } from 'satori';
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

export function svgDimensions(svg: string) {
  const match = /^<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/.exec(svg);
  if (!match) throw new Error('Satori did not return numeric SVG dimensions');
  return { width: Math.ceil(Number(match[1])), height: Math.ceil(Number(match[2])) };
}

export async function layoutOptions(
  strategy: SizeStrategy,
  measure: ReactNode | undefined,
  base: Omit<SatoriOptions, 'width' | 'height'>,
  config: Config,
): Promise<{ width: number; height?: number } | { height: number }> {
  if (strategy.mode === 'fixed') {
    assertDimensions(strategy.width, strategy.height, config);
    return { width: strategy.width, height: strategy.height };
  }
  if (strategy.mode === 'auto-height') {
    assertDimensions(strategy.width, 1, config);
    return { width: strategy.width };
  }
  if (strategy.mode === 'auto-width') {
    assertDimensions(1, strategy.height, config);
    return { height: strategy.height };
  }
  if (!measure || strategy.minWidth > strategy.maxWidth) throw new Error('Invalid content sizing strategy');
  assertDimensions(strategy.minWidth, 1, config);
  const maxWidth = Math.min(strategy.maxWidth, config.maxWidth);
  let intrinsicWidth = strategy.minWidth;
  // Probe text without wrapping and use the measured right edge plus mirrored
  // left padding. Height is NEVER estimated here; final Satori layout decides it.
  await satori(measure, {
    ...base,
    width: maxWidth,
    onNodeDetected(node) {
      if (node.props['data-measure']) intrinsicWidth = Math.max(intrinsicWidth, node.left * 2 + node.width);
    },
  });
  return { width: Math.max(strategy.minWidth, Math.min(maxWidth, Math.ceil(intrinsicWidth))) };
}
