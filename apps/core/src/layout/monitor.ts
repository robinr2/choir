import {
  activeColumn,
  addColumn,
  addPane,
  emptySpace,
  isEmpty,
  removeColumnAt,
  removeTile,
} from './scrolling.js';
import type { Layout, Space } from './layout.schemas.js';

export type Direction = -1 | 1;

export function emptyLayout(): Layout {
  return { workspaces: [emptySpace()], activeWorkspace: 0 };
}

export function activeSpace(layout: Layout): Space {
  return layout.workspaces[layout.activeWorkspace];
}

export function updateSpace(
  layout: Layout,
  index: number,
  update: (space: Space) => Space,
): Layout {
  const workspaces = layout.workspaces.with(
    index,
    update(layout.workspaces[index]),
  );
  return { ...layout, workspaces };
}

export function updateActiveSpace(
  layout: Layout,
  update: (space: Space) => Space,
): Layout {
  return settle(updateSpace(layout, layout.activeWorkspace, update));
}

function withEmptyBottom(layout: Layout): Layout {
  const last = layout.workspaces[layout.workspaces.length - 1];
  if (isEmpty(last)) return layout;
  return { ...layout, workspaces: [...layout.workspaces, emptySpace()] };
}

function isKept(layout: Layout, index: number): boolean {
  return (
    !isEmpty(layout.workspaces[index]) ||
    index === layout.activeWorkspace ||
    index === layout.workspaces.length - 1
  );
}

export function settle(layout: Layout): Layout {
  const bottomed = withEmptyBottom(layout);
  const kept = bottomed.workspaces.flatMap((_, index) =>
    isKept(bottomed, index) ? [index] : [],
  );
  return {
    workspaces: kept.map((index) => bottomed.workspaces[index]),
    activeWorkspace: kept.indexOf(bottomed.activeWorkspace),
  };
}

export function activateWorkspace(layout: Layout, index: number): Layout {
  return settle({ ...layout, activeWorkspace: index });
}

function neighbour(layout: Layout, direction: Direction): number {
  const index = layout.activeWorkspace + direction;
  return Math.min(Math.max(index, 0), layout.workspaces.length - 1);
}

export function focusWorkspace(layout: Layout, direction: Direction): Layout {
  return activateWorkspace(layout, neighbour(layout, direction));
}

export function moveWorkspace(layout: Layout, direction: Direction): Layout {
  const target = neighbour(layout, direction);
  const workspaces = layout.workspaces
    .with(target, activeSpace(layout))
    .with(layout.activeWorkspace, layout.workspaces[target]);
  return activateWorkspace({ ...layout, workspaces }, target);
}

type Transfer = {
  take: (space: Space) => Space;
  give: (space: Space) => Space;
};

function moveBetween(
  layout: Layout,
  direction: Direction,
  transfer: (source: Space) => Transfer,
): Layout {
  const source = activeSpace(layout);
  const target = neighbour(layout, direction);
  if (target === layout.activeWorkspace || isEmpty(source)) return layout;
  const { take, give } = transfer(source);
  const taken = updateSpace(layout, layout.activeWorkspace, take);
  return activateWorkspace(updateSpace(taken, target, give), target);
}

export function moveColumnToWorkspace(
  layout: Layout,
  direction: Direction,
): Layout {
  return moveBetween(layout, direction, (source) => ({
    take: (space) => removeColumnAt(space, space.activeColumn),
    give: (space) => addColumn(space, activeColumn(source), { activate: true }),
  }));
}

export function moveWindowToWorkspace(
  layout: Layout,
  direction: Direction,
): Layout {
  return moveBetween(layout, direction, (source) => {
    const removed = removeTile(source, {
      column: source.activeColumn,
      tile: activeColumn(source).activeTile,
    });
    return {
      take: () => removed.space,
      give: (space) => addPane(space, removed.paneId, { size: removed.size }),
    };
  });
}
