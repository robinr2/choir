import { randomUUID } from 'node:crypto';
import type { Column, ColumnSize, Height, Tile } from './layout.schemas.js';

const MAX_PROPORTION = 10_000;

export const AUTO: Height = { auto: 1 };

export function clampWidth(width: number): number {
  return Math.min(Math.max(width, 0), MAX_PROPORTION);
}

export function newColumn(paneId: string, size: ColumnSize): Column {
  const tiles = [{ paneId, height: AUTO }];
  return { id: randomUUID(), ...size, activeTile: 0, tiles };
}

export function contains(column: Column, paneId: string): boolean {
  return column.tiles.some((tile) => tile.paneId === paneId);
}

export function activeTile(column: Column): Tile {
  return column.tiles[column.activeTile];
}

export function sizeOf({ width, fullWidth }: Column): ColumnSize {
  return { width, fullWidth };
}

export function activateTile(column: Column, index: number): Column {
  return { ...column, activeTile: index };
}

export function focusUp(column: Column): Column {
  return activateTile(column, Math.max(column.activeTile - 1, 0));
}

export function focusDown(column: Column): Column {
  return activateTile(
    column,
    Math.min(column.activeTile + 1, column.tiles.length - 1),
  );
}

function swapActiveWith(column: Column, index: number): Column {
  const tiles = column.tiles
    .with(index, column.tiles[column.activeTile])
    .with(column.activeTile, column.tiles[index]);
  return { ...column, tiles, activeTile: index };
}

export function moveUp(column: Column): Column {
  if (column.activeTile === 0) return column;
  return swapActiveWith(column, column.activeTile - 1);
}

export function moveDown(column: Column): Column {
  if (column.activeTile === column.tiles.length - 1) return column;
  return swapActiveWith(column, column.activeTile + 1);
}

export function insertTile(column: Column, index: number, paneId: string) {
  const tiles = column.tiles.toSpliced(index, 0, { paneId, height: AUTO });
  const shift = index <= column.activeTile ? 1 : 0;
  return { ...column, tiles, activeTile: column.activeTile + shift };
}

function soleWeightReset(tiles: Tile[]): Tile[] {
  const [only] = tiles;
  if (tiles.length > 1 || !('auto' in only.height)) return tiles;
  return [{ ...only, height: AUTO }];
}

function activeAfterRemoval(column: Column, index: number): number {
  if (index < column.activeTile) return column.activeTile - 1;
  return Math.min(column.activeTile, column.tiles.length - 2);
}

export function removeTileAt(column: Column, index: number): Column {
  return {
    ...column,
    tiles: soleWeightReset(column.tiles.toSpliced(index, 1)),
    activeTile: activeAfterRemoval(column, index),
  };
}

export function setColumnWidth(column: Column, change: number): Column {
  const current = column.fullWidth ? 1 : column.width;
  return {
    ...column,
    width: clampWidth(current + change / 100),
    fullWidth: false,
  };
}

export function resizeColumn(column: Column, width: number): Column {
  return { ...column, width: clampWidth(width), fullWidth: false };
}

export function toggleFullWidth(column: Column): Column {
  return { ...column, fullWidth: !column.fullWidth };
}
