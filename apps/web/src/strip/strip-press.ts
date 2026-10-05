import { startMove } from './move-gesture';
import { startOverviewMove } from './overview-move';
import { OVERVIEW_ZOOM, workspaceAt } from './overview';
import { startOverviewPan, startPan } from './pan-gesture';
import { focusedPaneId } from './placements';
import { startResize } from './resize-gesture';
import { type Grab, type Point, pointOf } from './session';
import type { Store } from './types';

type Start = (grab: Grab, paneId: string, point: Point) => void;

const TITLE = '[data-slot="pane-title"], [data-slot="pane-title"] :not(input)';

function onTitle(target: Element): boolean {
  return target.matches(TITLE);
}

function moves(event: PointerEvent, target: Element): boolean {
  return event.button === 0 && (event.altKey || onTitle(target));
}

function gestureFor(event: PointerEvent, target: Element): Start | null {
  if (moves(event, target)) return startMove;
  if (!event.altKey) return null;
  return event.button === 2 ? startResize : null;
}

function focus(grab: Grab, paneId: string): void {
  const { store } = grab;
  if (focusedPaneId(store.getSnapshot()) === paneId) return;
  void store.workspace.act({ action: 'focusPane', paneId });
}

function pressPane(grab: Grab, target: Element): void {
  const paneId = target.closest('[data-pane-id]')?.getAttribute('data-pane-id');
  if (!paneId) return;
  focus(grab, paneId);
  const start = gestureFor(grab.event, target);
  if (!start) return;
  grab.event.preventDefault();
  start(grab, paneId, pointOf(grab.root, grab.event));
}

function closeOn(store: Store, target: Element): void {
  const workspaceId = target
    .closest('[data-workspace-id]')
    ?.getAttribute('data-workspace-id');
  if (!workspaceId) return;
  const index = store
    .getSnapshot()
    .view.workspaces.findIndex(({ id }) => id === workspaceId);
  store.overview(false, index);
  void store.workspace.act({ action: 'focusWorkspace', workspaceId });
}

function panOverview(grab: Grab, view: boolean): void {
  const { event, root, store } = grab;
  const point = pointOf(root, event);
  const index = workspaceAt(store.getSnapshot(), point.y);
  if (index === null) return;
  event.preventDefault();
  startOverviewPan(grab, point, { index, zoom: OVERVIEW_ZOOM, view });
}

function pansOverview(grab: Grab): boolean {
  const { button, altKey } = grab.event;
  if (button === 2) panOverview(grab, true);
  else if (button === 1 && altKey) panOverview(grab, false);
  return button !== 0;
}

function pressOverview(grab: Grab, target: Element): void {
  const { event, root, store } = grab;
  if (pansOverview(grab)) return;
  const paneId = target.closest('[data-pane-id]')?.getAttribute('data-pane-id');
  if (!paneId) return closeOn(store, target);
  event.preventDefault();
  startOverviewMove(grab, paneId, pointOf(root, event));
}

export function press(grab: Grab): void {
  const { event, root } = grab;
  if (!(event.target instanceof Element)) return;
  if (grab.store.getSnapshot().overview) {
    return pressOverview(grab, event.target);
  }
  if (!event.altKey || event.button !== 1) return pressPane(grab, event.target);
  event.preventDefault();
  startPan(grab, pointOf(root, event));
}
