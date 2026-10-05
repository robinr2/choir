import type { Store } from './types';

export type Point = { x: number; y: number; time: number };

export type Session = {
  move(point: Point): void;
  end(point: Point): void;
};

export type Grab = { store: Store; root: HTMLElement; event: PointerEvent };

export function pointOf(root: HTMLElement, event: PointerEvent): Point {
  const box = root.getBoundingClientRect();
  return {
    x: event.clientX - box.left,
    y: event.clientY - box.top,
    time: event.timeStamp,
  };
}

function swallowClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

function swallowNextClick(): void {
  window.addEventListener('click', swallowClick, { capture: true, once: true });
  setTimeout(() => {
    window.removeEventListener('click', swallowClick, { capture: true });
  });
}

export function track(
  { store, root, event }: Grab,
  session: Session,
  cursor: string | null,
): void {
  const controller = new AbortController();
  const mine = (other: PointerEvent) => other.pointerId === event.pointerId;
  const start = pointOf(root, event);
  const onEnd = (other: PointerEvent) => {
    if (!mine(other)) return;
    controller.abort();
    store.grab(null);
    const point = pointOf(root, other);
    session.end(point);
    if (point.x !== start.x || point.y !== start.y) swallowNextClick();
  };
  const onMove = (other: PointerEvent) => {
    if (other.buttons === 0) return onEnd(other);
    if (mine(other)) session.move(pointOf(root, other));
  };
  const { signal } = controller;
  window.addEventListener('pointermove', onMove, { signal });
  window.addEventListener('pointerup', onEnd, { signal });
  window.addEventListener('pointercancel', onEnd, { signal });
  store.grab(cursor);
}
