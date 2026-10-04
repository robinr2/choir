import { resizeColumn, setColumnWidth, toggleFullWidth } from './column.js';
import { resetWindowHeight, setWindowHeight } from './column-heights.js';
import { activeColumn, isEmpty, updateActive } from './scrolling.js';
import type { Column, Space } from './layout.schemas.js';

function widthOf(column: Column): number {
  return column.fullWidth ? 1 : column.width;
}

export function adjustColumnWidth(space: Space, change: number): Space {
  return updateActive(space, (column) => setColumnWidth(column, change));
}

export function maximizeColumn(space: Space): Space {
  return updateActive(space, toggleFullWidth);
}

export function adjustWindowHeight(space: Space, change: number): Space {
  return updateActive(space, (column) =>
    setWindowHeight(column, { adjust: change }),
  );
}

export function resetActiveWindowHeight(space: Space): Space {
  return updateActive(space, resetWindowHeight);
}

function expanded(column: Column, others: Column[]): Column {
  if (others.length === 0) return toggleFullWidth(column);
  const taken = others.reduce((sum, other) => sum + widthOf(other), 0);
  return resizeColumn(column, 1 - taken);
}

function isExpandable(space: Space, visible: Column[]): boolean {
  const column = activeColumn(space);
  const taken = visible.reduce((sum, other) => sum + widthOf(other), 0);
  return !column.fullWidth && visible.includes(column) && taken < 1;
}

export function expandColumnToAvailableWidth(
  space: Space,
  visibleColumns: readonly string[],
): Space {
  if (isEmpty(space)) return space;
  const visible = space.columns.filter(({ id }) => visibleColumns.includes(id));
  if (!isExpandable(space, visible)) return space;
  const others = visible.filter((column) => column !== activeColumn(space));
  return updateActive(space, (column) => expanded(column, others));
}
