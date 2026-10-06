import { activateTile, resizeColumn } from './column.js';
import { setWindowHeight } from './column-heights.js';
import {
  activateWorkspace,
  settle,
  updateActiveSpace,
  updateSpace,
} from './monitor.js';
import {
  activateColumn,
  addPane,
  addTileToColumn,
  emptySpace,
  placeOf,
  type Removed,
  removeTile,
  type TilePlace,
  updateColumn,
} from './scrolling.js';
import type { Layout, Space } from './layout.schemas.js';

export type PaneSpot = { workspace: number } & TilePlace;

export type Drop = { column: number; tile?: number; workspaceId?: string };

export type Resize = { width?: number; height?: number };

const NEW_PANE = { width: 0.5, fullWidth: false };

export function findPane(layout: Layout, paneId: string): PaneSpot {
  const spots = layout.workspaces.flatMap((space, workspace) => {
    const place = placeOf(space, paneId);
    return place ? [{ workspace, ...place }] : [];
  });
  return spots[0];
}

export function paneIds({ workspaces }: Layout): string[] {
  return workspaces.flatMap(({ columns }) =>
    columns.flatMap(({ tiles }) => tiles.map(({ paneId }) => paneId)),
  );
}

export function openPane(layout: Layout, paneId: string): Layout {
  return updateActiveSpace(layout, (space) =>
    addPane(space, paneId, { size: NEW_PANE }),
  );
}

export function openPaneNextTo(
  layout: Layout,
  paneId: string,
  nextTo: string,
): Layout {
  const { workspace, column } = findPane(layout, nextTo);
  const opened = updateSpace(layout, workspace, (space) =>
    addPane(space, paneId, { index: column + 1, size: NEW_PANE }),
  );
  return activateWorkspace(opened, workspace);
}

export function removePane(layout: Layout, paneId: string): Layout {
  const { workspace, ...place } = findPane(layout, paneId);
  const removed = updateSpace(
    layout,
    workspace,
    (space) => removeTile(space, place).space,
  );
  return settle(removed);
}

export function focusPane(layout: Layout, paneId: string): Layout {
  const { workspace, column, tile } = findPane(layout, paneId);
  const focused = updateSpace(layout, workspace, (space) =>
    activateColumn(
      updateColumn(space, column, (c) => activateTile(c, tile)),
      column,
    ),
  );
  return activateWorkspace(focused, workspace);
}

export function focusColumn(
  layout: Layout,
  columnId: string,
  workspace = layout.activeWorkspace,
): Layout {
  return updateSpace(layout, workspace, (space) =>
    activateColumn(
      space,
      space.columns.findIndex(({ id }) => id === columnId),
    ),
  );
}

export function focusWorkspaceById(layout: Layout, id: string): Layout {
  const index = layout.workspaces.findIndex((space) => space.id === id);
  return activateWorkspace(layout, index);
}

function fits(space: Space, { column, tile }: Drop): boolean {
  if (tile === undefined) return column <= space.columns.length;
  const target = space.columns.at(column);
  return target !== undefined && tile <= target.tiles.length;
}

function dropped(space: Space, removed: Removed, drop: Drop): Space {
  const { paneId, size } = removed;
  return drop.tile === undefined
    ? addPane(space, paneId, { index: drop.column, size })
    : addTileToColumn(space, paneId, { ...drop, activate: true });
}

function targetOf(layout: Layout, workspaceId: string | undefined): number {
  if (workspaceId === undefined) return layout.activeWorkspace;
  return layout.workspaces.findIndex(({ id }) => id === workspaceId);
}

function takePane(layout: Layout, paneId: string) {
  const { workspace, ...place } = findPane(layout, paneId);
  const removed = removeTile(layout.workspaces[workspace], place);
  return { removed, rest: updateSpace(layout, workspace, () => removed.space) };
}

export function movePane(
  layout: Layout,
  paneId: string,
  drop: Drop,
): Layout | undefined {
  const { removed, rest } = takePane(layout, paneId);
  const target = targetOf(rest, drop.workspaceId);
  const space = rest.workspaces.at(target);
  if (target < 0 || !space || !fits(space, drop)) return undefined;
  return settle(
    updateSpace(rest, target, (into) => dropped(into, removed, drop)),
  );
}

function withSpaceAt(layout: Layout, index: number): Layout {
  const last = layout.workspaces.length - 1;
  if (index >= last) return layout;
  return {
    workspaces: layout.workspaces.toSpliced(index, 0, emptySpace()),
    activeWorkspace:
      layout.activeWorkspace + (index <= layout.activeWorkspace ? 1 : 0),
  };
}

export function movePaneToNewWorkspace(
  layout: Layout,
  paneId: string,
  index: number,
): Layout {
  const { removed, rest } = takePane(layout, paneId);
  const spaced = withSpaceAt(rest, index);
  const target = Math.min(index, spaced.workspaces.length - 1);
  return settle(
    updateSpace(spaced, target, (space) =>
      addPane(space, removed.paneId, { size: removed.size }),
    ),
  );
}

export function resizePane(
  layout: Layout,
  paneId: string,
  { width, height }: Resize,
): Layout {
  const { workspace, column, tile } = findPane(layout, paneId);
  return updateSpace(layout, workspace, (space) =>
    updateColumn(space, column, (resized) => {
      const wide = width === undefined ? resized : resizeColumn(resized, width);
      return height === undefined
        ? wide
        : setWindowHeight(wide, { set: height }, tile);
    }),
  );
}
