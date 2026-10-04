import type { Column, StripLayout } from '@/workspace/core-workspace';
import { columnWidth, columnXs, tileHeights, tileYs } from './geometry';
import type { Metrics, Rect, Strip } from './types';

export type InsertPosition = { column: number; tile?: number };

type Point = { x: number; y: number };

const HINT_WIDTH = 300;

const HINT_HEIGHT = 150;

function closest(values: readonly number[], target: number): number {
  const distances = values.map((value) => Math.abs(value - target));
  return distances.indexOf(Math.min(...distances));
}

function ysOf(column: Column, metrics: Metrics): number[] {
  const heights = tileHeights(
    column.tiles.map(({ height }) => height),
    metrics,
  );
  return tileYs(heights, metrics.gap);
}

function tileIn(
  column: Column,
  [x, columnX]: readonly [number, number],
  y: number,
  metrics: Metrics,
): number | null {
  const ys = ysOf(column, metrics);
  const tile = closest(ys, y);
  return Math.abs(columnX - x) <= Math.abs(ys[tile] - y) ? null : tile;
}

export function insertPosition(
  { layout, viewX }: Strip,
  pointer: Point,
  metrics: Metrics,
): InsertPosition {
  const x = pointer.x + viewX + metrics.gap / 2;
  const xs = columnXs(layout.columns, metrics);
  const near = closest(xs, x);
  const within = xs.findLastIndex((columnX) => Math.max(columnX, x) === x);
  const column = layout.columns[within];
  const y = pointer.y + metrics.gap / 2;
  const tile =
    column === undefined ? null : tileIn(column, [x, xs[near]], y, metrics);
  return tile === null ? { column: near } : { column: within, tile };
}

function newColumnHint(
  layout: StripLayout,
  index: number,
  metrics: Metrics,
): Rect {
  const { gap, height } = metrics;
  const x = columnXs(layout.columns, metrics)[index];
  const size = { y: gap, width: HINT_WIDTH, height: height - 2 * gap };
  if (index === 0 && layout.columns.length > 0) {
    return { ...size, x: x - HINT_WIDTH - gap };
  }
  if (index === layout.columns.length) return { ...size, x };
  return { ...size, x: x - HINT_WIDTH / 2 - gap / 2 };
}

function tileHint(ys: readonly number[], tile: number, gap: number) {
  const top = ys[tile];
  if (tile === 0) return { y: top, height: HINT_HEIGHT };
  if (tile === ys.length - 1) {
    return { y: top - gap - HINT_HEIGHT, height: HINT_HEIGHT };
  }
  return { y: top - gap / 2 - HINT_HEIGHT, height: 2 * HINT_HEIGHT };
}

function inColumnHint(
  layout: StripLayout,
  { column, tile }: Required<InsertPosition>,
  metrics: Metrics,
): Rect {
  const target = layout.columns[column];
  const x = columnXs(layout.columns, metrics)[column];
  const width = columnWidth(target, metrics);
  return { x, width, ...tileHint(ysOf(target, metrics), tile, metrics.gap) };
}

export function hintRect(
  { layout, viewX }: Strip,
  position: InsertPosition,
  metrics: Metrics,
): Rect {
  const rect =
    position.tile === undefined
      ? newColumnHint(layout, position.column, metrics)
      : inColumnHint(
          layout,
          { column: position.column, tile: position.tile },
          metrics,
        );
  const shift = layout.columns.length === 0 ? -metrics.gap : viewX;
  return { ...rect, x: rect.x - shift };
}
