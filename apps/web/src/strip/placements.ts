import type { Column } from '@/workspace/core-workspace';
import {
  columnWidth,
  columnXs,
  locate,
  tileHeights,
  tileYs,
  viewXOf,
} from './geometry';
import type {
  Location,
  Metrics,
  Overlay,
  Rect,
  Snapshot,
  Strip,
  StripView,
} from './types';

export type Placement = {
  paneId: string;
  rect: Rect;
  focused: boolean;
  dragged: boolean;
};

export function workspaceGap(metrics: Metrics): number {
  return Math.round(metrics.height * 0.1);
}

function overlaid(strip: StripView, overlay: Overlay, metrics: Metrics) {
  return {
    layout: overlay.layout ?? strip.layout,
    viewX: overlay.viewX ?? viewXOf(strip, metrics),
  };
}

function stripOf(snapshot: Snapshot, index: number) {
  const layout = snapshot.view.workspaces.at(index);
  return layout && snapshot.strips.get(layout.id);
}

function stripAt(snapshot: Snapshot, index: number): Strip | null {
  const strip = stripOf(snapshot, index);
  if (!strip) return null;
  const active = index === snapshot.view.activeWorkspace;
  const overlay = (active && snapshot.overlay) || {};
  return overlaid(strip, overlay, snapshot.metrics);
}

export function pressed(snapshot: Snapshot, paneId: string) {
  const strip = activeStrip(snapshot);
  const location = strip && locate(strip.layout, paneId);
  if (!location) return null;
  return { strip, location, rect: rectOf(strip, location, snapshot.metrics) };
}

function rectOf(
  { layout, viewX }: Strip,
  { column, tile }: Location,
  metrics: Metrics,
): Rect {
  const x = columnXs(layout.columns, metrics)[column] - viewX;
  return columnRects(layout.columns[column], x, metrics)[tile];
}

export function activeStrip(snapshot: Snapshot): Strip | null {
  return stripAt(snapshot, snapshot.view.activeWorkspace);
}

export function columnRects(
  column: Column,
  x: number,
  metrics: Metrics,
): Rect[] {
  const width = columnWidth(column, metrics);
  const heights = tileHeights(
    column.tiles.map(({ height }) => height),
    metrics,
  );
  const ys = tileYs(heights, metrics.gap);
  return heights.map((height, index) => ({
    x,
    y: ys[index],
    width,
    height,
  }));
}

function stripPlacements(
  { layout, viewX }: Strip,
  top: number,
  active: boolean,
  metrics: Metrics,
): Placement[] {
  const xs = columnXs(layout.columns, metrics);
  return layout.columns.flatMap((column, index) => {
    const rects = columnRects(column, xs[index] - viewX, metrics);
    const focusedColumn = active && index === layout.activeColumn;
    return column.tiles.map(({ paneId }, tile) => ({
      paneId,
      rect: { ...rects[tile], y: top + rects[tile].y },
      focused: focusedColumn && tile === column.activeTile,
      dragged: false,
    }));
  });
}

export function placements(snapshot: Snapshot): Placement[] {
  const { metrics, view, renderIndex, overlay } = snapshot;
  const step = metrics.height + workspaceGap(metrics);
  const dragged = overlay?.dragged;
  const strips = [...snapshot.strips.values()];
  const tiled = strips.flatMap((stored, index) => {
    const active = index === view.activeWorkspace;
    const strip = overlaid(stored, (active && overlay) || {}, metrics);
    const top = (index - renderIndex) * step;
    const focusable = active && !dragged;
    return stripPlacements(strip, top, focusable, metrics);
  });
  if (!dragged) return tiled;
  const { paneId, ...rect } = dragged;
  const others = tiled.filter((placement) => placement.paneId !== paneId);
  return [...others, { paneId, rect, focused: true, dragged: true }];
}

export function focusedPaneId(snapshot: Snapshot): string | undefined {
  const layout = snapshot.view.workspaces[snapshot.view.activeWorkspace];
  const column = layout?.columns[layout.activeColumn];
  return column?.tiles[column.activeTile].paneId;
}
