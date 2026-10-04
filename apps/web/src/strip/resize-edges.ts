import type { Edges, Press, Rect } from './types';

const DOUBLE_CLICK = 400;

export function edgesAt(rect: Rect, x: number, y: number): Edges {
  const across = (x - rect.x) / rect.width;
  const down = (y - rect.y) / rect.height;
  return {
    left: across < 1 / 3,
    right: across > 2 / 3,
    top: down < 1 / 3,
    bottom: down > 2 / 3,
  };
}

export function horizontal({ left, right }: Edges): boolean {
  return left || right;
}

export function vertical({ top, bottom }: Edges): boolean {
  return top || bottom;
}

export function cursorFor(edges: Edges): string {
  const north = edges.top ? 'n' : '';
  const side = edges.bottom ? 's' : north;
  const west = edges.left ? 'w' : '';
  return `${side}${edges.right ? 'e' : west}-resize`;
}

function shared(first: Edges, second: Edges): Edges {
  return {
    left: first.left && second.left,
    right: first.right && second.right,
    top: first.top && second.top,
    bottom: first.bottom && second.bottom,
  };
}

function quick(last: Press | null, press: Press): last is Press {
  if (!last) return false;
  return last.paneId === press.paneId && press.time - last.time <= DOUBLE_CLICK;
}

export class DoubleClicks {
  #last: Press | null = null;

  repeated(press: Press): Edges | null {
    const last = this.#last;
    this.#last = press;
    if (!quick(last, press)) return null;
    this.#last = null;
    return shared(last.edges, press.edges);
  }
}
