import { focusDown, focusUp, moveDown, moveUp } from './column.js';
import { activateColumn, isEmpty, updateActive } from './scrolling.js';
import type { Space } from './layout.schemas.js';

export function focusColumnLeft(space: Space): Space {
  if (space.activeColumn === 0) return space;
  return activateColumn(space, space.activeColumn - 1);
}

export function focusColumnRight(space: Space): Space {
  if (space.activeColumn + 1 >= space.columns.length) return space;
  return activateColumn(space, space.activeColumn + 1);
}

export function focusWindowUp(space: Space): Space {
  return updateActive(space, focusUp);
}

export function focusWindowDown(space: Space): Space {
  return updateActive(space, focusDown);
}

export function moveWindowUp(space: Space): Space {
  return updateActive(space, moveUp);
}

export function moveWindowDown(space: Space): Space {
  return updateActive(space, moveDown);
}

function moveColumnTo(space: Space, index: number): Space {
  const moved = space.columns[space.activeColumn];
  const columns = space.columns
    .toSpliced(space.activeColumn, 1)
    .toSpliced(index, 0, moved);
  return activateColumn({ ...space, columns }, index);
}

export function moveColumnLeft(space: Space): Space {
  if (space.activeColumn === 0) return space;
  return moveColumnTo(space, space.activeColumn - 1);
}

export function moveColumnRight(space: Space): Space {
  if (isEmpty(space) || space.activeColumn + 1 === space.columns.length) {
    return space;
  }
  return moveColumnTo(space, space.activeColumn + 1);
}
