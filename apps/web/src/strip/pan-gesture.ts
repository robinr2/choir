import { workspaceStep } from './overview';
import { activeStrip, overlaidStrips } from './placements';
import { bandClamp } from './rubber-band';
import { type Grab, type Point, type Session, track } from './session';
import { snapView } from './snap';
import { SwipeTracker } from './swipe-tracker';
import type { Store, Strip } from './types';

const RECOGNIZE = 8 * 8;

const WORKSPACE_BAND = { stiffness: 0.5, limit: 0.05 };

type Mode = 'recognizing' | 'view' | 'workspaces';

type Target = { strip: Strip; index: number; zoom: number };

class PanSession implements Session {
  readonly #store: Store;
  readonly #target: Target;
  readonly #strip: Strip;
  readonly #tracker = new SwipeTracker();
  #mode: Mode;
  #last: Point;

  constructor(store: Store, point: Point, target: Target, mode: Mode) {
    this.#store = store;
    this.#target = target;
    this.#strip = target.strip;
    this.#last = point;
    this.#mode = mode;
  }

  move(point: Point): void {
    if (this.#mode === 'recognizing') return this.#recognize(point);
    const delta =
      this.#mode === 'view' ? point.x - this.#last.x : point.y - this.#last.y;
    this.#last = point;
    this.#tracker.push(-delta / this.#target.zoom, point.time);
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
      const { layout, viewX } = this.#strip;
      const shown = viewX + this.#tracker.pos;
      this.#store.show({ workspaceId: layout.id, viewX: shown });
      return;
    }
    const { index, bounds, step } = this.#workspaces();
    const target = index + this.#tracker.pos / step;
    const { stiffness, limit } = WORKSPACE_BAND;
    const band = { stiffness, limit: limit / this.#target.zoom };
    this.#store.scrollWorkspaces(bandClamp(band, bounds, target));
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
      step: workspaceStep(metrics),
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
    void this.#store.workspace.act({
      action: 'focusColumn',
      columnId,
      ...this.#elsewhere(),
    });
  }

  #elsewhere(): { workspaceId?: string } {
    const { view } = this.#store.getSnapshot();
    if (this.#target.index === view.activeWorkspace) return {};
    return { workspaceId: this.#strip.layout.id };
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

function begin(grab: Grab, point: Point, target: Target, mode: Mode): void {
  track(grab, new PanSession(grab.store, point, target, mode), 'all-scroll');
}

export function startPan(grab: Grab, point: Point): void {
  const snapshot = grab.store.getSnapshot();
  const strip = activeStrip(snapshot);
  if (!strip) return;
  const index = snapshot.view.activeWorkspace;
  begin(grab, point, { strip, index, zoom: 1 }, 'recognizing');
}

export function startOverviewPan(
  grab: Grab,
  point: Point,
  { index, zoom, view }: { index: number; zoom: number; view: boolean },
): void {
  const strip = overlaidStrips(grab.store.getSnapshot())[index];
  begin(grab, point, { strip, index, zoom }, view ? 'view' : 'recognizing');
}
