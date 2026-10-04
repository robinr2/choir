import { AUTO } from './column.js';
import type { Column, Height, Tile } from './layout.schemas.js';

export type HeightChange = { adjust: number } | { set: number };

const SMALLEST = 0.01;

function clampHeight(height: number): number {
  return Math.min(Math.max(height, 0), 1);
}

function weightOf(height: Height): number {
  return 'auto' in height ? height.auto : 0;
}

function fixedShare(tiles: Tile[]): number {
  const fixed = tiles.find((tile) => 'fixed' in tile.height)?.height;
  return fixed && 'fixed' in fixed ? clampHeight(fixed.fixed) : 0;
}

export function effectiveHeights(column: Column): number[] {
  const left = 1 - fixedShare(column.tiles);
  const weights = column.tiles.map((tile) => weightOf(tile.height));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return column.tiles.map(({ height }) =>
    'fixed' in height
      ? clampHeight(height.fixed)
      : (left * height.auto) / total,
  );
}

export function convertHeightsToAuto(column: Column): Column {
  const heights = effectiveHeights(column).map((h) => Math.max(h, SMALLEST));
  const median = heights.toSorted((a, b) => a - b)[heights.length >> 1];
  const tiles = column.tiles.map((tile, index) => ({
    ...tile,
    height: { auto: heights[index] / median },
  }));
  return { ...column, tiles };
}

function withHeight(column: Column, index: number, height: Height): Column {
  const tiles = column.tiles.with(index, { ...column.tiles[index], height });
  return { ...column, tiles };
}

function changed(current: number, change: HeightChange): number {
  return 'adjust' in change ? current + change.adjust / 100 : change.set;
}

export function setWindowHeight(
  column: Column,
  change: HeightChange,
  index = column.activeTile,
): Column {
  const auto = 'auto' in column.tiles[index].height;
  const converted = auto ? convertHeightsToAuto(column) : column;
  const current = effectiveHeights(converted)[index];
  const fixed = clampHeight(changed(current, change));
  return withHeight(converted, index, { fixed });
}

export function resetWindowHeight(column: Column): Column {
  return withHeight(column, column.activeTile, AUTO);
}
