import { randomUUID } from 'node:crypto';
import {
  activateTile,
  insertTile,
  newColumn,
  removeTileAt,
  sizeOf,
} from './column.js';
import type { Column, ColumnSize, Space } from './layout.schemas.js';

export type Removed = { space: Space; paneId: string; size: ColumnSize };

export type PanePlace = {
  index?: number;
  size: ColumnSize;
  activate?: boolean;
};

export type TilePlace = { column: number; tile: number };

export function emptySpace(): Space {
  return {
    id: randomUUID(),
    columns: [],
    activeColumn: 0,
    restoresPrevious: false,
  };
}

export function isEmpty(space: Space): boolean {
  return space.columns.length === 0;
}

export function activeColumn(space: Space): Column {
  return space.columns[space.activeColumn];
}

export function placeOf(space: Space, paneId: string): TilePlace | undefined {
  const column = space.columns.findIndex((candidate) =>
    candidate.tiles.some((tile) => tile.paneId === paneId),
  );
  if (column < 0) return undefined;
  const { tiles } = space.columns[column];
  return { column, tile: tiles.findIndex((tile) => tile.paneId === paneId) };
}

export function activateColumn(space: Space, index: number): Space {
  if (space.activeColumn === index) return space;
  return { ...space, activeColumn: index, restoresPrevious: false };
}

export function updateColumn(
  space: Space,
  index: number,
  update: (column: Column) => Column,
): Space {
  const columns = space.columns.with(index, update(space.columns[index]));
  return { ...space, columns };
}

export function updateActive(
  space: Space,
  update: (column: Column) => Column,
): Space {
  if (isEmpty(space)) return space;
  return updateColumn(space, space.activeColumn, update);
}

function withColumn(space: Space, column: Column, at: number): Space {
  const shift = !isEmpty(space) && at <= space.activeColumn ? 1 : 0;
  return {
    ...space,
    columns: space.columns.toSpliced(at, 0, column),
    activeColumn: space.activeColumn + shift,
  };
}

function openingIndex(space: Space): number {
  return isEmpty(space) ? 0 : space.activeColumn + 1;
}

export function addColumn(
  space: Space,
  column: Column,
  { index, activate }: { index?: number; activate: boolean },
): Space {
  const at = index ?? openingIndex(space);
  const added = withColumn(space, column, at);
  if (!activate) return added;
  const restoresPrevious = !isEmpty(space) && at === added.activeColumn + 1;
  return { ...activateColumn(added, at), restoresPrevious };
}

export function addPane(
  space: Space,
  paneId: string,
  { index, size, activate = true }: PanePlace,
): Space {
  return addColumn(space, newColumn(paneId, size), { index, activate });
}

function focusAfterRemoval(space: Space, index: number): Space {
  if (index < space.activeColumn) {
    return {
      ...space,
      activeColumn: space.activeColumn - 1,
      restoresPrevious: false,
    };
  }
  if (index === space.activeColumn && space.restoresPrevious) {
    return activateColumn(space, space.activeColumn - 1);
  }
  return activateColumn(
    space,
    Math.min(space.activeColumn, space.columns.length - 1),
  );
}

export function removeColumnAt(space: Space, index: number): Space {
  const columns = space.columns.toSpliced(index, 1);
  if (columns.length === 0) return { ...emptySpace(), id: space.id };
  return focusAfterRemoval({ ...space, columns }, index);
}

export function removeTile(space: Space, { column, tile }: TilePlace): Removed {
  const source = space.columns[column];
  const removed = { paneId: source.tiles[tile].paneId, size: sizeOf(source) };
  if (source.tiles.length === 1) {
    return { ...removed, space: removeColumnAt(space, column) };
  }
  const shrunk = updateColumn(space, column, (c) => removeTileAt(c, tile));
  return { ...removed, space: shrunk };
}

export function addTileToColumn(
  space: Space,
  paneId: string,
  place: { column: number; tile?: number; activate: boolean },
): Space {
  const target = space.columns[place.column];
  const tile = place.tile ?? target.tiles.length;
  const inserted = updateColumn(space, place.column, (column) => {
    const added = insertTile(column, tile, paneId);
    return place.activate ? activateTile(added, tile) : added;
  });
  return place.activate ? activateColumn(inserted, place.column) : inserted;
}
