import type { Metrics } from './types';
import type { StripLayout } from '@/workspace/core-workspace';
import { activeX, columnWidth } from './geometry';

export function padding(width: number, metrics: Metrics): number {
  return Math.min(Math.max((metrics.width - width) / 2, 0), metrics.gap);
}

export function fitView(
  viewX: number,
  [x, width]: readonly [number, number],
  metrics: Metrics,
): number {
  const span = Math.min(width, metrics.width);
  const pad = padding(span, metrics);
  const lowest = x + span + pad - metrics.width;
  return Math.min(Math.max(viewX, lowest), x - pad);
}

export function fitActive(
  layout: StripLayout,
  viewX: number,
  metrics: Metrics,
): number {
  const column = layout.columns[layout.activeColumn];
  if (!column) return viewX;
  const width = columnWidth(column, metrics);
  return fitView(viewX, [activeX(layout, metrics), width], metrics);
}
