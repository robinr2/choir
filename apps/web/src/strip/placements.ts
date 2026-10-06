import type { Column, StripLayout } from '@/workspace/core-workspace';
import { toWorkspace, zoomOf } from './overview';
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
  workspaceId: string;
  rect: Rect;
  focused: boolean;
  muted: boolean;
  dragged: boolean;
};

export type Space = { id: string; index: number; viewX: number };

function overlaid(strip: StripView, overlay: Overlay, metrics: Metrics) {
  return {
    layout: overlay.layout ?? strip.layout,
    viewX: overlay.viewX ?? viewXOf(strip, metrics),
  };
}

function scrolledView(strip: Strip, overlay: Overlay | null): Strip {
  const viewX = overlay?.scrolled?.[strip.layout.id];
  if (viewX !== undefined) strip.viewX = viewX;
  return strip;
}

function stripOf(snapshot: Snapshot, index: number) {
  const layout = snapshot.view.workspaces.at(index);
  return layout && snapshot.strips.get(layout.id);
}

export function pressed(snapshot: Snapshot, paneId: string) {
  const strip = activeStrip(snapshot);
  const location = strip && locate(strip.layout, paneId);
  if (!location) return null;
  return { strip, location, rect: rectOf(strip, location, snapshot.metrics) };
}

export function located(snapshot: Snapshot, paneId: string) {
  const found = overlaidStrips(snapshot).flatMap((strip, index) => {
    const location = locate(strip.layout, paneId);
    return location ? [{ index, strip, location }] : [];
  });
  if (found.length === 0) return null;
  const { strip, location } = found[0];
  return { ...found[0], rect: rectOf(strip, location, snapshot.metrics) };
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
  const strip = stripOf(snapshot, snapshot.view.activeWorkspace);
  if (!strip) return null;
  return overlaid(strip, snapshot.overlay ?? {}, snapshot.metrics);
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
  { id, columns, activeColumn }: StripLayout,
  focusable: boolean,
  metrics: Metrics,
): Placement[] {
  const xs = columnXs(columns, metrics);
  return columns.flatMap((column, index) => {
    const rects = columnRects(column, xs[index], metrics);
    return column.tiles.map(({ paneId }, tile) => {
      const active = index === activeColumn && tile === column.activeTile;
      return {
        paneId,
        workspaceId: id,
        rect: rects[tile],
        focused: focusable && active,
        muted: active && !focusable,
        dragged: false,
      };
    });
  });
}

function overlays(snapshot: Snapshot, id: string, index: number): boolean {
  const target = snapshot.overlay?.workspaceId;
  return target === undefined
    ? index === snapshot.view.activeWorkspace
    : target === id;
}

export function overlaidStrips(snapshot: Snapshot): Strip[] {
  const { metrics, overlay } = snapshot;
  return [...snapshot.strips.values()].map((stored, index) => {
    const shown = overlays(snapshot, stored.layout.id, index) && overlay;
    return scrolledView(overlaid(stored, shown || {}, metrics), overlay);
  });
}

export function spaces(snapshot: Snapshot): Space[] {
  return overlaidStrips(snapshot).map(({ layout, viewX }, index) => ({
    id: layout.id,
    index,
    viewX,
  }));
}

type Dragged = NonNullable<Overlay['dragged']>;

function draggedSpace(snapshot: Snapshot): number {
  const target = snapshot.overlay?.workspaceId;
  const index = snapshot.view.workspaces.findIndex(({ id }) => id === target);
  return index < 0 ? snapshot.view.activeWorkspace : index;
}

function draggedPlacement(
  snapshot: Snapshot,
  { paneId, ...rect }: Dragged,
): Placement {
  const { renderIndex, metrics, overview } = snapshot;
  const index = draggedSpace(snapshot);
  const space = spaces(snapshot)[index];
  const stack = { metrics, renderIndex, zoom: zoomOf(overview), count: 0 };
  const { x, y } = toWorkspace(stack, index).point(rect);
  return {
    paneId,
    workspaceId: space.id,
    rect: { ...rect, x: x + space.viewX, y },
    focused: true,
    muted: false,
    dragged: true,
  };
}

export function placements(snapshot: Snapshot): Placement[] {
  const { metrics, view, overlay } = snapshot;
  const dragged = overlay?.dragged;
  const tiled = overlaidStrips(snapshot).flatMap(({ layout }, index) => {
    const focusable = index === view.activeWorkspace && !dragged;
    return stripPlacements(layout, focusable, metrics);
  });
  if (!dragged) return tiled;
  const others = tiled.filter(({ paneId }) => paneId !== dragged.paneId);
  return [...others, draggedPlacement(snapshot, dragged)];
}

export function focusedPaneId(snapshot: Snapshot): string | undefined {
  const layout = snapshot.view.workspaces[snapshot.view.activeWorkspace];
  const column = layout?.columns[layout.activeColumn];
  return column?.tiles[column.activeTile].paneId;
}
