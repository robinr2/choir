import {
  activeColumn,
  addPane,
  addTileToColumn,
  isEmpty,
  type Removed,
  removeTile,
} from './scrolling.js';
import type { Space } from './layout.schemas.js';

function removeActive(space: Space): Removed {
  const column = space.activeColumn;
  return removeTile(space, { column, tile: activeColumn(space).activeTile });
}

function expel(space: Space, index: number): Space {
  const { space: rest, paneId, size } = removeActive(space);
  return addPane(rest, paneId, { index, size });
}

function aloneInColumn(space: Space): boolean {
  return activeColumn(space).tiles.length === 1;
}

export function consumeOrExpelWindowLeft(space: Space): Space {
  if (isEmpty(space)) return space;
  if (!aloneInColumn(space)) {
    return { ...expel(space, space.activeColumn), restoresPrevious: false };
  }
  if (space.activeColumn === 0) return space;
  const target = space.activeColumn - 1;
  const { space: rest, paneId } = removeActive(space);
  return addTileToColumn(rest, paneId, { column: target, activate: true });
}

export function consumeOrExpelWindowRight(space: Space): Space {
  if (isEmpty(space)) return space;
  if (!aloneInColumn(space)) return expel(space, space.activeColumn + 1);
  if (space.activeColumn + 1 === space.columns.length) return space;
  const target = space.activeColumn;
  const { space: rest, paneId } = removeActive(space);
  return addTileToColumn(rest, paneId, { column: target, activate: true });
}

export function consumeWindowIntoColumn(space: Space): Space {
  if (space.activeColumn + 1 >= space.columns.length) return space;
  const target = space.activeColumn;
  const { space: rest, paneId } = removeTile(space, {
    column: target + 1,
    tile: 0,
  });
  return addTileToColumn(rest, paneId, { column: target, activate: false });
}

export function expelWindowFromColumn(space: Space): Space {
  if (isEmpty(space) || aloneInColumn(space)) return space;
  const column = space.activeColumn;
  const last = activeColumn(space).tiles.length - 1;
  const {
    space: rest,
    paneId,
    size,
  } = removeTile(space, {
    column,
    tile: last,
  });
  return addPane(rest, paneId, { index: column + 1, size, activate: false });
}
