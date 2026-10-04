import type { StripLayout } from '@/workspace/core-workspace';
import { columnXs, proportionOf } from './geometry';
import type { Anchor, Metrics, StripView } from './types';
import { fitted } from './view-diff';

function widened(layout: StripLayout, width: number): boolean {
  const active = layout.columns.at(layout.activeColumn);
  return active !== undefined && proportionOf(active) !== width;
}

function placed(strip: StripView, anchor: Anchor, metrics: Metrics) {
  const { columns } = strip.layout;
  const index = columns.findIndex(({ id }) => id === anchor.columnId);
  if (index < 0) return null;
  const x = columnXs(columns, metrics)[index] - metrics.gap;
  return fitted(strip.layout, x, strip.saved, metrics);
}

export function anchored(
  anchor: Anchor,
  strips: ReadonlyMap<string, StripView>,
  metrics: Metrics,
): Map<string, StripView> | null {
  const strip = strips.get(anchor.workspaceId);
  if (!strip || !widened(strip.layout, anchor.width)) return null;
  const view = placed(strip, anchor, metrics);
  return view && new Map(strips).set(anchor.workspaceId, view);
}
