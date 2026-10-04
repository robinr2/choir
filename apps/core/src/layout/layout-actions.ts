import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  Layout,
  WorkspaceAction,
  WorkspaceActionName,
} from './layout.schemas.js';
import {
  activeSpace,
  type Direction,
  focusWorkspace,
  moveColumnToWorkspace,
  moveWindowToWorkspace,
  moveWorkspace,
} from './monitor.js';
import {
  focusColumn,
  focusPane,
  focusWorkspaceById,
  movePane,
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
  return resizePane(layout, action.paneId, action);
}

function toColumn(layout: Layout, columnId: string): Layout {
  if (!activeSpace(layout).columns.some(({ id }) => id === columnId)) {
    throw new NotFoundException(`There is no column ${columnId} in view`);
  }
  return focusColumn(layout, columnId);
}

function toWorkspace(layout: Layout, workspaceId: string): Layout {
  if (!layout.workspaces.some(({ id }) => id === workspaceId)) {
    throw new NotFoundException(`There is no workspace ${workspaceId}`);
  }
  return focusWorkspaceById(layout, workspaceId);
}

export function layoutChange(layout: Layout, action: WorkspaceAction): Layout {
  if ('paneId' in action) return byPane(layout, action);
  if ('columnId' in action) return toColumn(layout, action.columnId);
  if ('workspaceId' in action) return toWorkspace(layout, action.workspaceId);
  return CHANGES[action.action](layout);
}
