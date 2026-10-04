import type { StripLayout } from '@/workspace/core-workspace';
import { fitActive } from './fit';
import { activeX, columnXs, viewXOf } from './geometry';
import type { Metrics, StripView } from './types';

function activeId(layout: StripLayout): string {
  return layout.columns[layout.activeColumn]?.id;
}

function ids(layout: StripLayout): string[] {
  return layout.columns.map(({ id }) => id);
}

function xOf(layout: StripLayout, id: string, metrics: Metrics): number {
  const index = ids(layout).indexOf(id);
  return columnXs(layout.columns, metrics)[index];
}

function reordered(before: StripLayout, after: StripLayout): boolean {
  const kept = ids(before).toSorted().join();
  return (
    kept === ids(after).toSorted().join() &&
    before.activeColumn !== after.activeColumn
  );
}

function slotX(before: StripLayout, after: StripLayout, metrics: Metrics) {
  const kept = new Set(ids(after));
  const later = ids(before).slice(before.activeColumn + 1);
  const survivor = later.find((id) => kept.has(id));
  if (survivor) return xOf(after, survivor, metrics);
  return columnXs(after.columns, metrics)[after.columns.length];
}

function restores(before: StripLayout, after: StripLayout): boolean {
  const previous = before.columns[before.activeColumn - 1]?.id;
  const gone = !ids(after).includes(activeId(before));
  return before.restoresPrevious && gone && previous === activeId(after);
}

function sameColumnX(prev: StripView, layout: StripLayout, metrics: Metrics) {
  if (reordered(prev.layout, layout)) return viewXOf(prev, metrics);
  return activeX(layout, metrics) + prev.offset;
}

function otherColumnX(prev: StripView, layout: StripLayout, metrics: Metrics) {
  const before = prev.layout;
  const old = activeId(before);
  if (restores(before, layout)) return activeX(layout, metrics) + prev.saved;
  if (ids(layout).includes(old)) return xOf(layout, old, metrics) + prev.offset;
  return slotX(before, layout, metrics) + prev.offset;
}

function savedOffset(prev: StripView, layout: StripLayout): number {
  const moved = activeId(prev.layout) !== activeId(layout);
  const fresh = !prev.layout.restoresPrevious || moved;
  return layout.restoresPrevious && fresh ? prev.offset : prev.saved;
}

export function fitted(
  layout: StripLayout,
  viewX: number,
  saved: number,
  metrics: Metrics,
): StripView {
  const x = fitActive(layout, viewX, metrics);
  return { layout, offset: x - activeX(layout, metrics), saved };
}

function anchoredX(prev: StripView, layout: StripLayout, metrics: Metrics) {
  if (activeId(prev.layout) === activeId(layout)) {
    return sameColumnX(prev, layout, metrics);
  }
  return otherColumnX(prev, layout, metrics);
}

export function nextStripView(
  prev: StripView | undefined,
  layout: StripLayout,
  metrics: Metrics,
): StripView {
  if (!prev || prev.layout.columns.length === 0) {
    return fitted(layout, activeX(layout, metrics), prev?.saved ?? 0, metrics);
  }
  const x = anchoredX(prev, layout, metrics);
  return fitted(layout, x, savedOffset(prev, layout), metrics);
}

export function refitted(view: StripView, metrics: Metrics): StripView {
  return fitted(view.layout, viewXOf(view, metrics), view.saved, metrics);
}
