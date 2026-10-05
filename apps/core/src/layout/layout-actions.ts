import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  Layout,
  Space,
  WorkspaceAction,
  WorkspaceActionName,
} from './layout.schemas.js';
import {
  type Direction,
  settle,
  updateActiveSpace,
  updateSpace,
  focusWindowOrWorkspace,
  focusWorkspace,
  moveColumnToWorkspace,
  moveWindowOrToWorkspace,
  moveWindowToWorkspace,
  moveWorkspace,
} from './monitor.js';
import {
  focusColumn,
  focusPane,
  focusWorkspaceById,
  movePane,
  movePaneToNewWorkspace,
  resizePane,
} from './monitor-panes.js';

type Change = (layout: Layout) => Layout;

type ByPane = Extract<WorkspaceAction, { paneId: string }>;

function vertical(
  change: (layout: Layout, direction: Direction) => Layout,
  direction: Direction,
): Change {
  return (layout) => change(layout, direction);
}

const CHANGES: Record<WorkspaceActionName, Change> = {
  focusWorkspaceUp: vertical(focusWorkspace, -1),
  focusWorkspaceDown: vertical(focusWorkspace, 1),
  moveWindowToWorkspaceUp: vertical(moveWindowToWorkspace, -1),
  moveWindowToWorkspaceDown: vertical(moveWindowToWorkspace, 1),
  moveColumnToWorkspaceUp: vertical(moveColumnToWorkspace, -1),
  moveColumnToWorkspaceDown: vertical(moveColumnToWorkspace, 1),
  moveWorkspaceUp: vertical(moveWorkspace, -1),
  moveWorkspaceDown: vertical(moveWorkspace, 1),
  focusWindowOrWorkspaceUp: vertical(focusWindowOrWorkspace, -1),
  focusWindowOrWorkspaceDown: vertical(focusWindowOrWorkspace, 1),
  moveWindowUpOrToWorkspaceUp: vertical(moveWindowOrToWorkspace, -1),
  moveWindowDownOrToWorkspaceDown: vertical(moveWindowOrToWorkspace, 1),
};

function moved(layout: Layout | undefined): Layout {
  if (!layout) throw new BadRequestException('There is no such drop place');
  return layout;
}

function byPane(layout: Layout, action: ByPane): Layout {
  if (action.action === 'focusPane') return focusPane(layout, action.paneId);
  if (action.action === 'movePane') {
    return moved(movePane(layout, action.paneId, action));
  }
  if (action.action === 'movePaneToNewWorkspace') {
    return movePaneToNewWorkspace(layout, action.paneId, action.index);
  }
  return resizePane(layout, action.paneId, action);
}

function toColumn(
  layout: Layout,
  { columnId, workspaceId }: { columnId: string; workspaceId?: string },
): Layout {
  const workspace =
    workspaceId === undefined
      ? layout.activeWorkspace
      : workspaceIndex(layout, workspaceId);
  const { columns } = layout.workspaces[workspace];
  if (!columns.some(({ id }) => id === columnId)) {
    throw new NotFoundException(`There is no column ${columnId} in view`);
  }
  return focusColumn(layout, columnId, workspace);
}

function workspaceIndex(layout: Layout, workspaceId: string): number {
  const index = layout.workspaces.findIndex(({ id }) => id === workspaceId);
  if (index < 0) {
    throw new NotFoundException(`There is no workspace ${workspaceId}`);
  }
  return index;
}

function toWorkspace(layout: Layout, workspaceId: string): Layout {
  workspaceIndex(layout, workspaceId);
  return focusWorkspaceById(layout, workspaceId);
}

export function changeSpace(
  layout: Layout,
  workspaceId: string | undefined,
  change: (space: Space) => Space,
): Layout {
  if (workspaceId === undefined) return updateActiveSpace(layout, change);
  const index = workspaceIndex(layout, workspaceId);
  return settle(updateSpace(layout, index, change));
}

export function layoutChange(layout: Layout, action: WorkspaceAction): Layout {
  if ('paneId' in action) return byPane(layout, action);
  if ('columnId' in action) return toColumn(layout, action);
  if ('workspaceId' in action) return toWorkspace(layout, action.workspaceId);
  return CHANGES[action.action](layout);
}
