import type { SimpleAction } from '@/workspace/core-workspace';
import { ScrollTracker } from './scroll-tracker';

const TICK = 120;

const COOLDOWN = 150;

const SCALES = [1, 40, 800];

type Kind = 'focus' | 'move';

type Directions = Record<number, SimpleAction>;

const COLUMNS: Record<Kind, Directions> = {
  focus: { [-1]: 'focusColumnLeft', 1: 'focusColumnRight' },
  move: { [-1]: 'moveColumnLeft', 1: 'moveColumnRight' },
};

const WORKSPACES: Record<Kind, Directions> = {
  focus: { [-1]: 'focusWorkspaceUp', 1: 'focusWorkspaceDown' },
  move: { [-1]: 'moveColumnToWorkspaceUp', 1: 'moveColumnToWorkspaceDown' },
};

export class WheelBinds {
  readonly #vertical = new ScrollTracker(TICK);
  readonly #horizontal = new ScrollTracker(TICK);
  #ready = 0;

  commands(event: WheelEvent): SimpleAction[] {
    if (!event.altKey) return [];
    const scale = SCALES[event.deltaMode];
    const across = event.shiftKey ? event.deltaX + event.deltaY : event.deltaX;
    const down = event.shiftKey ? 0 : event.deltaY;
    const kind = event.ctrlKey ? 'move' : 'focus';
    return [
      ...this.#columns(across * scale, kind),
      ...this.#workspaces(down * scale, kind, event.timeStamp),
    ];
  }

  #columns(amount: number, kind: Kind): SimpleAction[] {
    if (amount === 0) return [];
    const ticks = this.#horizontal.accumulate(amount);
    const action = COLUMNS[kind][Math.sign(ticks)];
    return Array.from({ length: Math.abs(ticks) }, () => action);
  }

  #workspaces(amount: number, kind: Kind, now: number) {
    if (amount === 0) return [];
    const ticks = this.#vertical.accumulate(amount);
    if (ticks === 0 || now < this.#ready) return [];
    this.#ready = now + COOLDOWN;
    return [WORKSPACES[kind][Math.sign(ticks)]];
  }
}
