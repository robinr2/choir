import type {
  LayoutAction,
  Space,
  SpaceAction,
  SpaceActionName,
} from './layout.schemas.js';
import {
  consumeOrExpelWindowLeft,
  consumeOrExpelWindowRight,
  consumeWindowIntoColumn,
  expelWindowFromColumn,
} from './scrolling-consume.js';
import {
  focusColumnLeft,
  focusColumnRight,
  focusWindowDown,
  focusWindowUp,
  moveColumnLeft,
  moveColumnRight,
  moveWindowDown,
  moveWindowUp,
} from './scrolling-moves.js';
import {
  adjustColumnWidth,
  adjustWindowHeight,
  expandColumnToAvailableWidth,
  maximizeColumn,
  resetActiveWindowHeight,
} from './scrolling-sizes.js';

type SpaceChange = (space: Space) => Space;

const CHANGES: Record<SpaceActionName, SpaceChange> = {
  focusColumnLeft,
  focusColumnRight,
  focusWindowUp,
  focusWindowDown,
  moveColumnLeft,
  moveColumnRight,
  moveWindowUp,
  moveWindowDown,
  consumeOrExpelWindowLeft,
  consumeOrExpelWindowRight,
  consumeWindowIntoColumn,
  expelWindowFromColumn,
  resetWindowHeight: resetActiveWindowHeight,
  maximizeColumn,
};

export function isSpaceAction(action: LayoutAction): action is SpaceAction {
  return (
    'change' in action || 'visibleColumns' in action || action.action in CHANGES
  );
}

export function spaceChange(action: SpaceAction): SpaceChange {
  if ('visibleColumns' in action) {
    return (space) =>
      expandColumnToAvailableWidth(space, action.visibleColumns);
  }
  if ('change' in action) {
    const adjust =
      action.action === 'setColumnWidth'
        ? adjustColumnWidth
        : adjustWindowHeight;
    return (space) => adjust(space, action.change);
  }
  return CHANGES[action.action];
}

export function workspaceOf(action: SpaceAction): string | undefined {
  return 'workspaceId' in action ? action.workspaceId : undefined;
}
