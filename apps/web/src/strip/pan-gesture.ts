import { activeStrip, workspaceGap } from './placements';
import { bandClamp } from './rubber-band';
import { type Grab, type Point, type Session, track } from './session';
import { snapView } from './snap';
import { SwipeTracker } from './swipe-tracker';
import type { Store, Strip } from './types';

const RECOGNIZE = 8 * 8;

const WORKSPACE_BAND = { stiffness: 0.5, limit: 0.05 };

type Mode = 'recognizing' | 'view' | 'workspaces';

class PanSession implements Session {
  readonly #store: Store;
  readonly #strip: Strip;
  readonly #tracker = new SwipeTracker();
  #mode: Mode = 'recognizing';
  #last: Point;

  constructor(store: Store, point: Point, strip: Strip) {
    this.#store = store;
    this.#strip = strip;
    this.#last = point;
  }

  move(point: Point): void {
    if (this.#mode === 'recognizing') return this.#recognize(point);
    const delta =
      this.#mode === 'view' ? point.x - this.#last.x : point.y - this.#last.y;
    this.#last = point;
    this.#tracker.push(-delta, point.time);
    this.#render();
  }

  end(point: Point): void {
    this.#tracker.push(0, point.time);
    if (this.#mode === 'view') this.#snapView();
    if (this.#mode === 'workspaces') this.#snapWorkspace();
  }

  #recognize(point: Point): void {
    const dx = point.x - this.#last.x;
    const dy = point.y - this.#last.y;
    if (dx * dx + dy * dy < RECOGNIZE) return;
    this.#mode = Math.abs(dx) > Math.abs(dy) ? 'view' : 'workspaces';
    this.move(point);
  }

  #render(): void {
    if (this.#mode === 'view') {
      this.#store.show({ viewX: this.#strip.viewX + this.#tracker.pos });
      return;
    }
    const { index, bounds, step } = this.#workspaces();
    const target = index + this.#tracker.pos / step;
    this.#store.scrollWorkspaces(bandClamp(WORKSPACE_BAND, bounds, target));
  }

  #workspaces() {
    const { view, metrics } = this.#store.getSnapshot();
    const index = view.activeWorkspace;
    const last = view.workspaces.length - 1;
    const bounds = [Math.max(index - 1, 0), Math.min(index + 1, last)] as const;
    return {
      view,
      index,
      bounds,
      step: metrics.height + workspaceGap(metrics),
    };
  }

  #snapView(): void {
    const { layout, viewX } = this.#strip;
    if (layout.columns.length === 0) return this.#store.show(null);
    const current = viewX + this.#tracker.pos;
    const target = viewX + this.#tracker.projectedEndPos();
    const { metrics } = this.#store.getSnapshot();
    const snap = snapView(layout, { current, target }, metrics);
    this.#store.commit({ ...layout, activeColumn: snap.column }, snap.viewX);
    if (snap.column === layout.activeColumn) return;
    const columnId = layout.columns[snap.column].id;
    void this.#store.workspace.act({ action: 'focusColumn', columnId });
  }

  #snapWorkspace(): void {
    const { view, index, bounds, step } = this.#workspaces();
    const projected = index + this.#tracker.projectedEndPos() / step;
    const clamped = Math.min(Math.max(projected, bounds[0]), bounds[1]);
    const target = Math.round(clamped);
    this.#store.scrollWorkspaces(target);
    if (target === index) return;
    const workspaceId = view.workspaces[target].id;
    void this.#store.workspace.act({ action: 'focusWorkspace', workspaceId });
  }
}

export function startPan(grab: Grab, point: Point): void {
  const strip = activeStrip(grab.store.getSnapshot());
  if (!strip) return;
  track(grab, new PanSession(grab.store, point, strip), 'all-scroll');
}
