import { columnWidth } from './geometry';
import { columnRects, pressed } from './placements';
import { type Resize, resized } from './preview';
import { cursorFor, edgesAt, horizontal, vertical } from './resize-edges';
import { type Grab, type Point, type Session, track } from './session';
import type { Edges, Location, Metrics, Rect, Store, Strip } from './types';

type Start = {
  paneId: string;
  point: Point;
  rect: Rect;
  strip: Strip;
  location: Location;
  edges: Edges;
};

function proportion(pixels: number, size: number, gap: number): number {
  return (Math.max(1, pixels) + gap) / (size - gap);
}

function changeFor(start: Start, point: Point, metrics: Metrics): Resize {
  const { edges, rect } = start;
  const dx = point.x - start.point.x;
  const dy = point.y - start.point.y;
  const width = rect.width + (edges.left ? -dx : dx);
  const height = rect.height + (edges.top ? -dy : dy);
  return {
    width: horizontal(edges)
      ? proportion(width, metrics.width, metrics.gap)
      : undefined,
    height: vertical(edges)
      ? Math.min(1, proportion(height, metrics.height, metrics.gap))
      : undefined,
  };
}

class ResizeSession implements Session {
  readonly #store: Store;
  readonly #start: Start;
  readonly #pixels: number[];
  #preview: (Strip & { change: Resize }) | null = null;

  constructor(store: Store, start: Start) {
    this.#store = store;
    this.#start = start;
    const { metrics } = store.getSnapshot();
    const column = start.strip.layout.columns[start.location.column];
    this.#pixels = columnRects(column, 0, metrics).map(({ height }) => height);
  }

  move(point: Point): void {
    const { metrics } = this.#store.getSnapshot();
    const { strip, location, rect, edges } = this.#start;
    const change = changeFor(this.#start, point, metrics);
    const layout = resized(strip.layout, location, change, this.#pixels);
    const width = columnWidth(layout.columns[location.column], metrics);
    const viewX = strip.viewX + (edges.left ? width - rect.width : 0);
    this.#preview = { layout, viewX, change };
    this.#store.show({ layout, viewX });
  }

  end(): void {
    const preview = this.#preview;
    if (!preview) return;
    const { layout, viewX, change } = preview;
    this.#store.commit(layout, viewX);
    const { paneId } = this.#start;
    void this.#store.workspace.act({ action: 'resizePane', paneId, ...change });
  }
}

function toggle(store: Store, edges: Edges): void {
  const { workspace } = store;
  if (horizontal(edges)) void workspace.act({ action: 'maximizeColumn' });
  if (vertical(edges)) void workspace.act({ action: 'resetWindowHeight' });
}

function edgesFor(start: Omit<Start, 'edges'>): Edges {
  const found = edgesAt(start.rect, start.point.x, start.point.y);
  return { ...found, top: found.top && start.location.tile > 0 };
}

function begin(grab: Grab, start: Start): void {
  const { edges, paneId, point } = start;
  const twice = grab.store.clicks.repeated({ paneId, time: point.time, edges });
  if (twice) return toggle(grab.store, twice);
  track(grab, new ResizeSession(grab.store, start), cursorFor(edges));
}

export function startResize(grab: Grab, paneId: string, point: Point): void {
  const found = pressed(grab.store.getSnapshot(), paneId);
  if (!found) return;
  const edges = edgesFor({ ...found, paneId, point });
  if (horizontal(edges) || vertical(edges))
    begin(grab, { ...found, paneId, point, edges });
}
