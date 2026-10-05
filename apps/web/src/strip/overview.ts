import type { Metrics, Rect, Snapshot } from './types';

export const OVERVIEW_ZOOM = 0.5;

const HINT_WIDTH = 0.75;

const HINT_MARGIN = 0.1;

export type Stack = {
  metrics: Metrics;
  renderIndex: number;
  zoom: number;
  count: number;
};

export type DropTarget = { index: number; fresh: boolean };

type Point = { x: number; y: number };

function workspaceGap(metrics: Metrics): number {
  return Math.round(metrics.height * 0.1);
}

export function workspaceStep(metrics: Metrics): number {
  return metrics.height + workspaceGap(metrics);
}

export function zoomOf(overview: boolean): number {
  return overview ? OVERVIEW_ZOOM : 1;
}

function top({ metrics, renderIndex, zoom }: Stack, index: number): number {
  const offset = (metrics.height * (1 - zoom)) / 2;
  return offset + (index - renderIndex) * workspaceStep(metrics) * zoom;
}

export function workspaceRect(stack: Stack, index: number): Rect {
  const { metrics, zoom } = stack;
  return {
    x: (metrics.width * (1 - zoom)) / 2,
    y: top(stack, index),
    width: metrics.width * zoom,
    height: metrics.height * zoom,
  };
}

export function dropTarget(stack: Stack, y: number): DropTarget {
  const { metrics, zoom, count } = stack;
  const step = workspaceStep(metrics) * zoom;
  const index = Math.floor((y - top(stack, 0)) / step);
  if (index < 0) return { index: 0, fresh: true };
  if (index >= count) return { index: count, fresh: true };
  const within = y - top(stack, index) < metrics.height * zoom;
  return within ? { index, fresh: false } : { index: index + 1, fresh: true };
}

export function newWorkspaceHint(stack: Stack, index: number): Rect {
  const { metrics, zoom } = stack;
  const gap = (workspaceStep(metrics) - metrics.height) * zoom;
  const width = metrics.width * zoom * HINT_WIDTH;
  return {
    x: (metrics.width - width) / 2,
    y: top(stack, index) - gap + gap * HINT_MARGIN,
    width,
    height: gap * (1 - 2 * HINT_MARGIN),
  };
}

export function toWorkspace(stack: Stack, index: number) {
  const { x, y } = workspaceRect(stack, index);
  const { zoom } = stack;
  return {
    point: (point: Point): Point => ({
      x: (point.x - x) / zoom,
      y: (point.y - y) / zoom,
    }),
    rect: (rect: Rect): Rect => ({
      x: x + rect.x * zoom,
      y: y + rect.y * zoom,
      width: rect.width * zoom,
      height: rect.height * zoom,
    }),
  };
}

export function stackOf(snapshot: Snapshot, renderIndex: number): Stack {
  const { metrics, view, overview } = snapshot;
  const count = view.workspaces.length;
  return { metrics, renderIndex, zoom: zoomOf(overview), count };
}

export function workspaceAt(snapshot: Snapshot, y: number): number | null {
  const stack = stackOf(snapshot, snapshot.renderIndex);
  const { index, fresh } = dropTarget(stack, y);
  return fresh ? null : index;
}
