import type { Metrics } from './types';
import type { StripLayout } from '@/workspace/core-workspace';
import { columnXs } from './geometry';

const TRIGGER = 30;

const DELAY = 100;

const MAX_SPEED = 1500;

export function edgeFactor(x: number, width: number): number {
  const trigger = Math.min(TRIGGER, width / 2);
  if (trigger < 0.01) return 0;
  const inside = Math.min(Math.max(x, 0), width);
  const left = Math.max(trigger - inside, 0);
  const right = Math.max(inside - (width - trigger), 0);
  return (right - left) / trigger;
}

export function clampView(
  layout: StripLayout,
  viewX: number,
  metrics: Metrics,
): number {
  if (layout.columns.length === 0) return 0;
  const end = columnXs(layout.columns, metrics)[layout.columns.length];
  const bounds = [-metrics.width, end - metrics.gap];
  return Math.min(Math.max(viewX, Math.min(...bounds)), Math.max(...bounds));
}

export class EdgeScroll {
  #last: number | null = null;
  #since: number | null = null;

  step(factor: number, now: number): number {
    const last = this.#last ?? now;
    this.#last = now;
    if (factor === 0) {
      this.#since = null;
      return 0;
    }
    this.#since ??= now;
    if (now - this.#since < DELAY) return 0;
    return (factor * (now - last) * MAX_SPEED) / 1000;
  }
}
