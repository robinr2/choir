import { clampView, EdgeScroll, edgeFactor } from './edge-scroll';

import { hintRect, insertPosition } from './insert';
import { pressed } from './placements';
import { withoutPane } from './preview';
import { band } from './rubber-band';
import { type Grab, type Point, type Session, track } from './session';
import type { Location, Rect, Store, Strip } from './types';

const THRESHOLD = 256 * 256;

const START_BAND = { stiffness: 1, limit: 0.5 };

type Start = {
  paneId: string;
  point: Point;
  rect: Rect;
  strip: Strip;
  location: Location;
};

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function held({ paneId, point, rect }: Start, to: Point) {
  const dx = to.x - point.x;
  const dy = to.y - point.y;
  const distance = dx * dx + dy * dy;
  const factor = band(START_BAND, distance / THRESHOLD);
  const dragged = { ...rect, paneId, x: rect.x + dx * factor };
  return { distance, dragged: { ...dragged, y: rect.y + dy * factor } };
}

class MoveSession implements Session {
  readonly #store: Store;
  readonly #start: Start;
  readonly #ratio: { x: number; y: number };
  readonly #edge = new EdgeScroll();
  #view: Strip;
  #moving = false;
  #pointer: Point;
  #frame = 0;

  constructor(store: Store, start: Start) {
    this.#store = store;
    this.#start = start;
    this.#view = start.strip;
    this.#pointer = start.point;
    const { point, rect } = start;
    this.#ratio = {
      x: clamp01((point.x - rect.x) / rect.width),
      y: clamp01((point.y - rect.y) / rect.height),
    };
  }

  move(point: Point): void {
    this.#pointer = point;
    if (this.#moving) return this.#render();
    const { distance, dragged } = held(this.#start, point);
    if (distance < THRESHOLD) return this.#store.show({ dragged });
    this.#moving = true;
    const { strip, location } = this.#start;
    this.#view = { ...strip, layout: withoutPane(strip.layout, location) };
    this.#scroll(performance.now());
  }

  end(point: Point): void {
    cancelAnimationFrame(this.#frame);
    if (!this.#moving) return this.#store.show(null);
    const { metrics } = this.#store.getSnapshot();
    const position = insertPosition(this.#view, point, metrics);
    this.#store.commit(this.#view.layout, this.#view.viewX);
    const paneId = this.#start.paneId;
    void this.#store.workspace.act({ action: 'movePane', paneId, ...position });
  }

  readonly #scroll = (now: number): void => {
    const { layout, viewX } = this.#view;
    const { metrics } = this.#store.getSnapshot();
    const factor = edgeFactor(this.#pointer.x, metrics.width);
    const scrolled = viewX + this.#edge.step(factor, now);
    this.#view = { layout, viewX: clampView(layout, scrolled, metrics) };
    this.#render();
    this.#frame = requestAnimationFrame(this.#scroll);
  };

  #render(): void {
    const { metrics } = this.#store.getSnapshot();
    const { x, y } = this.#pointer;
    const { width, height } = this.#start.rect;
    const dragged = {
      paneId: this.#start.paneId,
      x: x - this.#ratio.x * width,
      y: y - this.#ratio.y * height,
      width,
      height,
    };
    const position = insertPosition(this.#view, this.#pointer, metrics);
    const hint = hintRect(this.#view, position, metrics);
    this.#store.show({ ...this.#view, dragged, hint });
  }
}

export function startMove(grab: Grab, paneId: string, point: Point): void {
  const found = pressed(grab.store.getSnapshot(), paneId);
  if (!found) return;
  const start = { ...found, paneId, point };
  track(grab, new MoveSession(grab.store, start), 'grabbing');
}
