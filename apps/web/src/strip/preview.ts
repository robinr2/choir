import type { Column, Height, StripLayout } from '@/workspace/core-workspace';
import type { Location } from './types';

export type Resize = { width?: number; height?: number };

function shifted(active: number, removed: number, count: number): number {
  const index = active - (removed < active ? 1 : 0);
  return Math.max(0, Math.min(index, count - 1));
}

function withoutTile(column: Column, tile: number): Column {
  const tiles = column.tiles.toSpliced(tile, 1);
  const activeTile = shifted(column.activeTile, tile, tiles.length);
  return { ...column, tiles, activeTile };
}

export function withoutPane(
  layout: StripLayout,
  { column, tile }: Location,
): StripLayout {
  const source = layout.columns[column];
  const columns =
    source.tiles.length === 1
      ? layout.columns.toSpliced(column, 1)
      : layout.columns.with(column, withoutTile(source, tile));
  const activeColumn = shifted(
    layout.activeColumn,
    source.tiles.length === 1 ? column : layout.columns.length,
    columns.length,
  );
  return { ...layout, columns, activeColumn };
}

function autoWeights(pixels: readonly number[]): Height[] {
  const median = pixels.toSorted((a, b) => a - b)[
    Math.floor(pixels.length / 2)
  ];
  return pixels.map((height) => ({ auto: height / median }));
}

function withHeight(
  column: Column,
  tile: number,
  [height, pixels]: readonly [number, readonly number[]],
): Column {
  const fixed = 'fixed' in column.tiles[tile].height;
  const heights = fixed
    ? column.tiles.map((entry) => entry.height)
    : autoWeights(pixels);
  const tiles = column.tiles.map((entry, index) => ({
    ...entry,
    height: index === tile ? { fixed: height } : heights[index],
  }));
  return { ...column, tiles };
}

function withWidth(column: Column, width: number | undefined): Column {
  if (width === undefined) return column;
  return { ...column, width, fullWidth: false };
}

export function resized(
  layout: StripLayout,
  { column, tile }: Location,
  change: Resize,
  pixels: readonly number[],
): StripLayout {
  const widened = withWidth(layout.columns[column], change.width);
  const target =
    change.height === undefined
      ? widened
      : withHeight(widened, tile, [change.height, pixels]);
  return { ...layout, columns: layout.columns.with(column, target) };
}
