import type { LayoutAction } from '@/workspace/core-workspace';
import { ScrollTracker } from './scroll-tracker';

const TICK = 120;

const COOLDOWN = 50;

const SCALES = [1, 40, 800];

const COLUMNS = { [-1]: 'focusColumnLeft', 1: 'focusColumnRight' } as const;

const WORKSPACES = {
  [-1]: 'focusWorkspaceUp',
  1: 'focusWorkspaceDown',
} as const;

type Direction = -1 | 1;

function directionOf(ticks: number): Direction {
  return ticks < 0 ? -1 : 1;
}

function columns(ticks: number, workspaceId: string | undefined) {
  if (workspaceId === undefined) return [];
  return Array.from({ length: Math.abs(ticks) }, () => ({
    action: COLUMNS[directionOf(ticks)],
    workspaceId,
  }));
}

function workspaces(ticks: number): LayoutAction[] {
  return ticks === 0 ? [] : [{ action: WORKSPACES[directionOf(ticks)] }];
}

function modified(event: WheelEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

export class OverviewWheel {
  readonly #vertical = new ScrollTracker(TICK);
  readonly #horizontal = new ScrollTracker(TICK);
  #ready = 0;

  commands(event: WheelEvent, workspaceId: string | undefined): LayoutAction[] {
    if (modified(event)) return [];
    const scale = SCALES[event.deltaMode];
    const across = this.#horizontal.accumulate(event.deltaX * scale);
    const down = this.#vertical.accumulate(event.deltaY * scale);
    const cooled = this.#cooled(down, event.timeStamp);
    const vertical = event.shiftKey
      ? columns(cooled, workspaceId)
      : workspaces(cooled);
    return [...columns(across, workspaceId), ...vertical];
  }

  #cooled(ticks: number, now: number): number {
    if (ticks === 0 || now < this.#ready) return 0;
    this.#ready = now + COOLDOWN;
    return Math.sign(ticks);
  }
}
