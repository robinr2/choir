import { clampView, EdgeScroll, edgeFactor } from './edge-scroll';
import type { LayoutAction } from '@/workspace/core-workspace';
import {
  type Drop,
  dropAt,
  scrollFactor,
  type Start,
  startOf,
} from './overview-drop';
import { type Stack, stackOf } from './overview';
import { withoutPane } from './preview';
import { band } from './rubber-band';
import { type Grab, type Point, type Session, track } from './session';
import type { Store, Strip } from './types';

const RECOGNIZE = 8 * 8;

const THRESHOLD = 256 * 256;

const START_BAND = { stiffness: 1, limit: 0.5 };

const SCROLL_DISTANCE = 1500;

function moveAction(
  paneId: string,
  drop: Drop,
  ids: readonly string[],
): LayoutAction {
  if (drop.fresh) {
    return { action: 'movePaneToNewWorkspace', paneId, index: drop.index };
  }
  const workspaceId = ids[drop.index];
  return { action: 'movePane', paneId, ...drop.position, workspaceId };
}

class OverviewMoveSession implements Session {
  readonly #store: Store;
  readonly #start: Start & { point: Point };
  readonly #edge = new EdgeScroll();
  readonly #side = new EdgeScroll();
  #views: Record<string, number> = {};
  #layout: Strip['layout'];
  #renderIndex: number;
  #recognized = false;
  #moving = false;
  #scrolled = false;
  #pointer: Point;
  #frame = 0;

  constructor(store: Store, start: Start & { point: Point }) {
    this.#store = store;
    this.#start = start;
    this.#layout = start.strip.layout;
    this.#pointer = start.point;
    this.#renderIndex = store.getSnapshot().renderIndex;
  }

  move(point: Point): void {
    this.#pointer = point;
    if (this.#moving) return this.#render();
    const dx = point.x - this.#start.point.x;
    const dy = point.y - this.#start.point.y;
    if (!this.#recognized && dx * dx + dy * dy < RECOGNIZE) return;
    this.#recognized = true;
    const { zoom } = stackOf(this.#store.getSnapshot(), this.#renderIndex);
    const distance = (dx * dx + dy * dy) / (zoom * zoom);
    if (distance < THRESHOLD) return this.#hold(dx, dy, distance);
    this.#begin();
  }

  end(point: Point): void {
    cancelAnimationFrame(this.#frame);
    if (!this.#recognized) return this.#pick();
    if (!this.#moving) return this.#store.show(null);
    this.#pointer = point;
    this.#drop();
  }

  #begin(): void {
    this.#moving = true;
    this.#store.grab('grabbing');
    const { strip, location } = this.#start;
    this.#layout = withoutPane(strip.layout, location);
    this.#scroll(performance.now());
  }

  #hold(dx: number, dy: number, distance: number): void {
    const factor = band(START_BAND, distance / THRESHOLD);
    const { rect, paneId } = this.#start;
    const dragged = {
      ...rect,
      paneId,
      x: rect.x + dx * factor,
      y: rect.y + dy * factor,
    };
    this.#store.show({ workspaceId: this.#sourceId(), dragged });
  }

  #pick(): void {
    const { index, paneId } = this.#start;
    this.#store.overview(false, index);
    void this.#store.workspace.act({ action: 'focusPane', paneId });
  }

  #sourceId(): string {
    return this.#start.strip.layout.id;
  }

  #overlay() {
    return {
      layout: this.#layout,
      workspaceId: this.#sourceId(),
      scrolled: this.#views,
    };
  }

  #target(): Drop {
    const snapshot = this.#store.getSnapshot();
    const stack = stackOf(snapshot, this.#renderIndex);
    const overlaid = { ...snapshot, overlay: this.#overlay() };
    return dropAt(overlaid, stack, this.#pointer);
  }

  #dragged() {
    const { paneId, point, rect } = this.#start;
    return {
      ...rect,
      paneId,
      x: rect.x + this.#pointer.x - point.x,
      y: rect.y + this.#pointer.y - point.y,
    };
  }

  #render(): void {
    this.#store.show({
      ...this.#overlay(),
      dragged: this.#dragged(),
      hint: this.#target().hint,
    });
  }

  #drop(): void {
    const target = this.#target();
    const ids = this.#store.getSnapshot().view.workspaces.map(({ id }) => id);
    const viewX = this.#views[this.#sourceId()] ?? this.#start.strip.viewX;
    this.#store.commit(this.#layout, viewX);
    this.#store.show({
      workspaceId: this.#sourceId(),
      scrolled: this.#views,
      dragged: this.#dragged(),
    });
    const { workspace } = this.#store;
    void workspace.act(moveAction(this.#start.paneId, target, ids));
    if (!this.#scrolled) return;
    const workspaceId = ids[Math.round(this.#renderIndex)];
    void workspace.act({ action: 'focusWorkspace', workspaceId });
  }

  readonly #scroll = (now: number): void => {
    const stack = stackOf(this.#store.getSnapshot(), this.#renderIndex);
    const factor = scrollFactor(stack, this.#pointer);
    const step = this.#edge.step(factor, now) / stack.zoom / SCROLL_DISTANCE;
    if (step !== 0) this.#scrollBy(step, stack.count - 1);
    this.#scrollSide(stack, now);
    this.#render();
    this.#frame = requestAnimationFrame(this.#scroll);
  };

  #scrollSide(stack: Stack, now: number): void {
    const factor = edgeFactor(this.#pointer.x, stack.metrics.width);
    const step = this.#side.step(factor, now) / stack.zoom;
    const target = this.#target();
    if (target.fresh) return;
    const { layout, viewX } = target.strip;
    const scrolled = clampView(layout, viewX + step, stack.metrics);
    this.#views = { ...this.#views, [layout.id]: scrolled };
  }

  #scrollBy(step: number, last: number): void {
    this.#renderIndex = Math.min(Math.max(this.#renderIndex + step, 0), last);
    this.#scrolled = true;
    this.#store.scrollWorkspaces(this.#renderIndex);
  }
}

export function startOverviewMove(
  grab: Grab,
  paneId: string,
  point: Point,
): void {
  const start = startOf(grab.store.getSnapshot(), paneId, point);
  if (!start) return;
  track(grab, new OverviewMoveSession(grab.store, start), null);
}
