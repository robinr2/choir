import {
  animate,
  type MotionValue,
  motionValue,
  type ValueAnimationTransition,
} from 'motion/react';

export type Mode = 'jump' | 'track' | 'animate';

type Transition = ValueAnimationTransition<number>;

const targets = new WeakMap<MotionValue<number>, number>();

const MODES: Record<
  Mode,
  (value: MotionValue<number>, target: number, transition: Transition) => void
> = {
  jump: (value, target) => value.jump(target),
  track: (value, target) => {
    value.stop();
    value.set(target);
  },
  animate: (value, target, transition) => {
    if (value.get() === target && !value.isAnimating()) return;
    animate(value, target, transition);
  },
};

export function drive(
  value: MotionValue<number>,
  target: number,
  mode: Mode,
  transition: Transition,
): void {
  if (targets.get(value) === target) return;
  targets.set(value, target);
  MODES[mode](value, target, transition);
}

export function targetOf(value: MotionValue<number>): number | undefined {
  return targets.get(value);
}

export function aim(value: MotionValue<number>, target: number): void {
  targets.set(value, target);
}

export function forget(value: MotionValue<number>): void {
  targets.delete(value);
}

type Correction = { fromZoom: number; to: number };

type Target = { renderIndex: number; zoom: number };

type StackTransitions = { workspace: Transition; overview: Transition };

function freeMode(view: Mode): Mode {
  return view === 'jump' ? 'jump' : 'animate';
}

export class StackMotion {
  readonly renderIndex = motionValue(0);
  readonly zoom = motionValue(1);
  readonly #transitions: StackTransitions;
  #correction: Correction | null = null;

  constructor(transitions: StackTransitions) {
    this.#transitions = transitions;
  }

  shown(): number {
    const index = this.renderIndex.get();
    if (!this.#correction) return index;
    const { fromZoom, to } = this.#correction;
    const zoom = this.zoom.get();
    return (index * fromZoom - to * (fromZoom - zoom)) / zoom;
  }

  moving(): boolean {
    return this.renderIndex.isAnimating() || this.zoom.isAnimating();
  }

  remap(map: (index: number) => number, target: number): void {
    this.renderIndex.jump(map(this.renderIndex.get()));
    aim(this.renderIndex, target);
    if (this.#correction) this.#correction.to = map(this.#correction.to);
  }

  apply(target: Target, view: Mode): void {
    if (this.#prepare(target, view)) return this.#together(target);
    drive(
      this.renderIndex,
      target.renderIndex,
      view,
      this.#transitions.workspace,
    );
    drive(this.zoom, target.zoom, freeMode(view), this.#transitions.overview);
  }

  #prepare(target: Target, view: Mode): boolean {
    const { zooms, switches } = this.#changes(target);
    if (zooms || switches) this.#uncorrect();
    return zooms && switches && view === 'animate';
  }

  #changes({ renderIndex, zoom }: Target) {
    const known = targetOf(this.zoom);
    return {
      zooms: known !== undefined && known !== zoom,
      switches: targetOf(this.renderIndex) !== renderIndex,
    };
  }

  #together({ renderIndex, zoom }: Target): void {
    this.#correction = { fromZoom: this.zoom.get(), to: renderIndex };
    drive(this.renderIndex, renderIndex, 'animate', this.#transitions.overview);
    drive(this.zoom, zoom, 'animate', this.#transitions.overview);
  }

  #uncorrect(): void {
    if (!this.#correction) return;
    const shown = this.shown();
    const target = this.#correction.to;
    this.#correction = null;
    this.renderIndex.jump(shown);
    forget(this.renderIndex);
    drive(this.renderIndex, target, 'animate', this.#transitions.workspace);
  }
}
