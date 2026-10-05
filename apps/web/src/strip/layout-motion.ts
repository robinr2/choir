import { animate, type MotionValue, motionValue } from 'motion/react';
import { aim, drive, forget, type Mode, StackMotion, targetOf } from './drive';
import type { Placement, Space } from './placements';
import { SpaceGaps } from './space-gaps';
import {
  CLOSE,
  MOVE,
  OPEN,
  OVERVIEW,
  RESIZE,
  VIEW,
  WORKSPACE,
} from './timings';

export type TileMotion = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  opacity: MotionValue<number>;
  scale: MotionValue<number>;
};

export type SpaceMotion = {
  viewX: MotionValue<number>;
  index: MotionValue<number>;
};

export type Tracking = 'none' | 'view' | 'all';

export type Frame = {
  placements: readonly Placement[];
  spaces: readonly Space[];
  renderIndex: number;
  step: number;
  width: number;
  height: number;
  zoom: number;
  ready: boolean;
  tracking: Tracking;
};

type Tile = { values: TileMotion; workspaceId: string; dragged: boolean };

function tileValues({ x, y, width, height }: Placement['rect']): TileMotion {
  return {
    x: motionValue(x),
    y: motionValue(y),
    width: motionValue(width),
    height: motionValue(height),
    opacity: motionValue(1),
    scale: motionValue(1),
  };
}

export class LayoutMotion {
  readonly #stack = new StackMotion({
    workspace: WORKSPACE,
    overview: OVERVIEW,
  });
  readonly renderIndex = this.#stack.renderIndex;
  readonly zoom = this.#stack.zoom;
  readonly step = motionValue(0);
  readonly width = motionValue(0);
  readonly height = motionValue(0);
  readonly #tiles = new Map<string, Tile>();
  readonly #spaces = new Map<string, SpaceMotion>();
  readonly #gaps = new SpaceGaps();
  #indices = new Map<string, number>();
  #renderIndex = 0;
  #ready = false;
  #size = '';

  constructor() {
    const settle = () => queueMicrotask(() => this.#settle());
    this.renderIndex.on('animationComplete', settle);
    this.zoom.on('animationComplete', settle);
  }

  tile({ paneId, rect, workspaceId }: Placement): TileMotion {
    const known = this.#tiles.get(paneId);
    if (known) return known.values;
    const values = tileValues(rect);
    if (this.#ready) {
      values.opacity.jump(0);
      values.scale.jump(0.5);
    }
    this.#tiles.set(paneId, { values, workspaceId, dragged: false });
    return values;
  }

  space(id: string, { index = 0, viewX = 0 } = {}): SpaceMotion {
    const known = this.#spaces.get(id);
    if (known) return known;
    const created = { viewX: motionValue(viewX), index: motionValue(index) };
    this.#spaces.set(id, created);
    return created;
  }

  shown(): number {
    return this.#stack.shown();
  }

  apply(frame: Frame): void {
    const free = this.#freeMode(frame);
    const view: Mode = frame.tracking === 'none' ? free : 'track';
    this.#measure(frame);
    this.#leave(frame, view);
    const renderIndex = this.#gaps.shown(frame.renderIndex);
    this.#stack.apply({ renderIndex, zoom: frame.zoom }, view);
    if (free === 'animate') this.#rebaseDrops(frame);
    frame.spaces.forEach((space) => this.#slide(space, view));
    frame.placements.forEach((placement) =>
      this.#place(placement, this.#modeOf(placement, frame, free)),
    );
    this.#settle();
  }

  async close(paneId: string): Promise<void> {
    const tile = this.#tiles.get(paneId);
    if (!tile) return;
    const { opacity, scale } = tile.values;
    aim(opacity, 0);
    aim(scale, 0.8);
    await Promise.all([animate(opacity, 0, CLOSE), animate(scale, 0.8, CLOSE)]);
    this.#tiles.delete(paneId);
  }

  #measure({ step, width, height }: Frame): void {
    this.step.jump(step);
    this.width.jump(width);
    this.height.jump(height);
  }

  #leave({ spaces, renderIndex }: Frame, view: Mode): void {
    const kept = new Set(spaces.map(({ id }) => id));
    for (const [id, space] of this.#spaces) {
      if (kept.has(id)) continue;
      if (view === 'animate') this.#gaps.add(space.index.get());
      this.#spaces.delete(id);
    }
    if (view !== 'animate') this.#close();
    this.#indices = new Map(spaces.map(({ id, index }) => [id, index]));
    this.#renderIndex = renderIndex;
  }

  #settle(): void {
    if (!this.#stack.moving()) this.#close();
  }

  #close(): void {
    if (!this.#gaps.open) return;
    this.#stack.remap(this.#gaps.collapse(), this.#renderIndex);
    for (const [id, index] of this.#indices) this.space(id).index.jump(index);
  }

  #freeMode(frame: Frame): Mode {
    const size = `${frame.width}x${frame.step}`;
    const instant = !this.#ready || size !== this.#size;
    this.#ready = frame.ready;
    this.#size = size;
    return instant ? 'jump' : 'animate';
  }

  #slide({ id, index, viewX }: Space, view: Mode): void {
    const space = this.space(id);
    const fresh = targetOf(space.viewX) === undefined;
    space.index.jump(this.#gaps.shown(index));
    drive(space.viewX, viewX, fresh ? 'jump' : view, VIEW);
  }

  #modeOf(placement: Placement, frame: Frame, free: Mode): Mode {
    const known = this.#tiles.get(placement.paneId);
    if (known && known.workspaceId !== placement.workspaceId) return 'jump';
    if (placement.dragged || frame.tracking === 'all') return 'track';
    return free;
  }

  #landed({ paneId, workspaceId }: Placement): Tile | undefined {
    const known = this.#tiles.get(paneId);
    if (!known?.dragged) return undefined;
    return known.workspaceId === workspaceId ? undefined : known;
  }

  #rebaseDrops(frame: Frame): void {
    for (const placement of frame.placements) {
      const known = this.#landed(placement);
      const into = frame.spaces.find(({ id }) => id === placement.workspaceId);
      if (!known || !into) continue;
      this.#rebase(known, into);
      known.workspaceId = into.id;
    }
  }

  #rebase({ values, workspaceId }: Tile, into: Space): void {
    const from = this.space(workspaceId);
    const target = this.space(into.id);
    const known = targetOf(target.viewX) !== undefined;
    const viewX = known ? target.viewX.get() : into.viewX;
    const rows = from.index.get() - this.#gaps.shown(into.index);
    values.x.jump(values.x.get() - from.viewX.get() + viewX);
    values.y.jump(values.y.get() + rows * this.step.get());
    forget(values.x);
    forget(values.y);
  }

  #place(placement: Placement, mode: Mode): void {
    const values = this.tile(placement);
    this.#tiles.set(placement.paneId, {
      values,
      workspaceId: placement.workspaceId,
      dragged: placement.dragged,
    });
    const { x, y, width, height } = placement.rect;
    drive(values.x, x, mode, MOVE);
    drive(values.y, y, mode, MOVE);
    drive(values.width, width, mode, RESIZE);
    drive(values.height, height, mode, RESIZE);
    drive(values.opacity, 1, 'animate', OPEN);
    drive(values.scale, 1, 'animate', OPEN);
  }
}
