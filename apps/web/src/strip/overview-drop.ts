import { hintRect, type InsertPosition, insertPosition } from './insert';
import {
  dropTarget,
  newWorkspaceHint,
  type Stack,
  stackOf,
  toWorkspace,
  workspaceRect,
} from './overview';
import { located, overlaidStrips } from './placements';
import type { Location, Rect, Snapshot, Strip } from './types';

const TRIGGER = 50;

type Point = { x: number; y: number };

export type Start = {
  paneId: string;
  point: Point;
  rect: Rect;
  index: number;
  strip: Strip;
  location: Location;
};

export type Drop =
  | { fresh: true; index: number; hint: Rect }
  | {
      fresh: false;
      index: number;
      position: InsertPosition;
      hint: Rect;
      strip: Strip;
    };

function across(stack: Stack, x: number): boolean {
  const rect = workspaceRect(stack, 0);
  return rect.x <= x && x < rect.x + rect.width;
}

function edge(y: number, height: number): number {
  const trigger = Math.min(TRIGGER, height / 2);
  const inside = Math.min(Math.max(y, 0), height);
  if (inside < trigger) return -(trigger - inside) / trigger;
  return Math.max(trigger - (height - inside), 0) / trigger;
}

export function scrollFactor(stack: Stack, point: Point): number {
  const { height } = stack.metrics;
  if (height <= 0 || !across(stack, point.x)) return 0;
  return edge(point.y, height);
}

export function dropAt(snapshot: Snapshot, stack: Stack, pointer: Point): Drop {
  const { index, fresh } = dropTarget(stack, pointer.y);
  const strip = fresh ? undefined : overlaidStrips(snapshot).at(index);
  if (!strip) {
    return { fresh: true, index, hint: newWorkspaceHint(stack, index) };
  }
  const { metrics } = stack;
  const { point, rect } = toWorkspace(stack, index);
  const position = insertPosition(strip, point(pointer), metrics);
  const hint = rect(hintRect(strip, position, metrics));
  return { fresh: false, index, position, hint, strip };
}

export function startOf(
  snapshot: Snapshot,
  paneId: string,
  point: Point & { time: number },
): (Start & { point: typeof point }) | null {
  const found = located(snapshot, paneId);
  if (!found) return null;
  const { index, rect } = found;
  const stack = stackOf(snapshot, snapshot.renderIndex);
  const shown = toWorkspace(stack, index).rect(rect);
  return { ...found, paneId, point, rect: { ...rect, x: shown.x, y: shown.y } };
}
