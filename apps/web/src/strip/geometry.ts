import type { Column, Height, StripLayout } from '@/workspace/core-workspace';
import type { Location, Metrics, StripView } from './types';

export const GAP = 4;

export const MIN_WIDTH = 160;

export const MIN_HEIGHT = 40;

export function proportionOf(column: Column): number {
  return column.fullWidth ? 1 : column.width;
}

export function columnWidth(column: Column, metrics: Metrics): number {
  const { width, gap } = metrics;
  return Math.max(MIN_WIDTH, (width - gap) * proportionOf(column) - gap);
}

export function columnXs(
  columns: readonly Column[],
  metrics: Metrics,
): number[] {
  let x = 0;
  return [
    0,
    ...columns.map(
      (column) => (x += columnWidth(column, metrics) + metrics.gap),
    ),
  ];
}

function autoHeights(
  remaining: number,
  weights: readonly number[],
  gap: number,
): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const heights = weights.map((weight) => (remaining * weight) / total - gap);
  const deficits = heights.map((height) => Math.max(MIN_HEIGHT - height, 0));
  const worst = Math.max(0, ...deficits);
  if (worst === 0) return heights;
  const small = deficits.indexOf(worst);
  const rest = autoHeights(
    remaining - MIN_HEIGHT - gap,
    weights.toSpliced(small, 1),
    gap,
  );
  return rest.toSpliced(small, 0, MIN_HEIGHT);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function fixedHeight(
  proportion: number,
  count: number,
  metrics: Metrics,
): number {
  const { height, gap } = metrics;
  const most = height - 2 * gap - (count - 1) * (MIN_HEIGHT + gap);
  return clamp((height - gap) * proportion - gap, MIN_HEIGHT, most);
}

export function tileHeights(
  heights: readonly Height[],
  metrics: Metrics,
): number[] {
  const fixed = heights.findIndex((height) => 'fixed' in height);
  const spec = heights[fixed];
  const proportion = spec && 'fixed' in spec ? spec.fixed : 0;
  const pixels = fixedHeight(proportion, heights.length, metrics);
  const taken = fixed < 0 ? 0 : pixels + metrics.gap;
  const autos = heights.flatMap((height) =>
    'auto' in height ? [height.auto] : [],
  );
  const shared = autoHeights(
    metrics.height - metrics.gap - taken,
    autos,
    metrics.gap,
  );
  return fixed < 0 ? shared : shared.toSpliced(fixed, 0, pixels);
}

export function tileYs(heights: readonly number[], gap: number): number[] {
  let y = gap;
  return [gap, ...heights.map((height) => (y += height + gap))];
}

export function activeX(layout: StripLayout, metrics: Metrics): number {
  return columnXs(layout.columns, metrics)[layout.activeColumn];
}

export function viewXOf(view: StripView, metrics: Metrics): number {
  return activeX(view.layout, metrics) + view.offset;
}

export function locate(layout: StripLayout, paneId: string): Location | null {
  const column = layout.columns.findIndex(({ tiles }) =>
    tiles.some((tile) => tile.paneId === paneId),
  );
  if (column < 0) return null;
  const { tiles } = layout.columns[column];
  return { column, tile: tiles.findIndex((tile) => tile.paneId === paneId) };
}
