import type { Metrics } from './types';
import type { StripLayout } from '@/workspace/core-workspace';
import { fitView, padding } from './fit';
import { columnWidth, columnXs } from './geometry';

type Snap = { viewX: number; column: number };

type Box = { x: number; width: number; pad: number };

export type Motion = { current: number; target: number };

function boxes(layout: StripLayout, metrics: Metrics): Box[] {
  const xs = columnXs(layout.columns, metrics);
  return layout.columns.map((column, index) => {
    const width = columnWidth(column, metrics);
    return { x: xs[index], width, pad: padding(width, metrics) };
  });
}

function edges({ x, width, pad }: Box, metrics: Metrics): [number, number] {
  return [x - pad, x + width + pad - metrics.width];
}

function snaps(all: readonly Box[], metrics: Metrics): Snap[] {
  const last = all.length - 1;
  const [leftmost] = edges(all[0], metrics);
  const [, rightmost] = edges(all[last], metrics);
  const inside = (viewX: number) =>
    Math.min(Math.max(viewX, leftmost), rightmost) === viewX;
  const inner = all.flatMap((box, column) =>
    edges(box, metrics)
      .filter(inside)
      .map((viewX) => ({ viewX, column })),
  );
  return [
    { viewX: leftmost, column: 0 },
    { viewX: rightmost, column: last },
    ...inner,
  ].toSorted((a, b) => a.viewX - b.viewX);
}

function nearest(all: readonly Snap[], target: number): Snap {
  const distances = all.map(({ viewX }) => Math.abs(viewX - target));
  return all[distances.indexOf(Math.min(...distances))];
}

function furthest(
  all: readonly Box[],
  snap: Snap,
  forwards: boolean,
  metrics: Metrics,
): number {
  const fits = ({ x, width, pad }: Box) =>
    forwards
      ? x + width + pad <= snap.viewX + metrics.width
      : snap.viewX <= x - pad;
  const indices = [...all.keys()];
  const order = forwards
    ? indices.slice(snap.column + 1)
    : indices.slice(0, snap.column).toReversed();
  let column = snap.column;
  for (const index of order) {
    if (!fits(all[index])) break;
    column = index;
  }
  return column;
}

export function snapView(
  layout: StripLayout,
  { current, target }: Motion,
  metrics: Metrics,
): Snap {
  const all = boxes(layout, metrics);
  const snap = nearest(snaps(all, metrics), target);
  const column = furthest(all, snap, target >= current, metrics);
  const { x, width } = all[column];
  return { column, viewX: fitView(snap.viewX, [x, width], metrics) };
}
