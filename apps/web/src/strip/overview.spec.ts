import { expect, test } from 'vitest';
import {
  dropTarget,
  newWorkspaceHint,
  type Stack,
  toWorkspace,
  workspaceRect,
  zoomOf,
} from './overview';

const STACK: Stack = {
  metrics: { width: 1000, height: 800, gap: 4 },
  renderIndex: 1,
  zoom: 0.5,
  count: 3,
};

test('zooms out to half size in the overview', () => {
  expect(zoomOf(true)).toBe(0.5);
  expect(zoomOf(false)).toBe(1);
});

test('stacks the workspaces at half size around the centre', () => {
  expect(workspaceRect(STACK, 1)).toEqual({
    x: 250,
    y: 200,
    width: 500,
    height: 400,
  });
  expect(workspaceRect(STACK, 0).y).toBe(200 - 440);
  expect(workspaceRect(STACK, 2).y).toBe(200 + 440);
  expect(workspaceRect({ ...STACK, zoom: 1 }, 2)).toEqual({
    x: 0,
    y: 880,
    width: 1000,
    height: 800,
  });
});

test('finds the workspace or the gap under the pointer', () => {
  expect(dropTarget(STACK, -300)).toEqual({ index: 0, fresh: true });
  expect(dropTarget(STACK, -200)).toEqual({ index: 0, fresh: false });
  expect(dropTarget(STACK, 180)).toEqual({ index: 1, fresh: true });
  expect(dropTarget(STACK, 200)).toEqual({ index: 1, fresh: false });
  expect(dropTarget(STACK, 599)).toEqual({ index: 1, fresh: false });
  expect(dropTarget(STACK, 600)).toEqual({ index: 2, fresh: true });
  expect(dropTarget(STACK, 640)).toEqual({ index: 2, fresh: false });
  expect(dropTarget(STACK, 1050)).toEqual({ index: 3, fresh: true });
  expect(dropTarget(STACK, 1100)).toEqual({ index: 3, fresh: true });
});

test('shows a new workspace as a bar in the gap', () => {
  expect(newWorkspaceHint(STACK, 1)).toEqual({
    x: 312.5,
    y: 164,
    width: 375,
    height: 32,
  });
});

test('turns points and rects between the overview and a workspace', () => {
  const { point, rect } = toWorkspace(STACK, 1);
  expect(point({ x: 300, y: 300 })).toEqual({ x: 100, y: 200 });
  expect(rect({ x: 100, y: 200, width: 50, height: 60 })).toEqual({
    x: 300,
    y: 300,
    width: 25,
    height: 30,
  });
});
