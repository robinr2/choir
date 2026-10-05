import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { A, coreShowsWorkspace, fakeCore, twoAgents } from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { CoreEvents } from '@/lib/core-events';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { viewXOf } from './geometry';
import { startOf } from './overview-drop';
import { startOverviewMove } from './overview-move';
import { startOverviewPan } from './pan-gesture';
import { ViewStore } from './view-store';

const PRESS = { x: 400, y: 300 };

let store: ViewStore;
let frames: FrameRequestCallback[];

function pointer(type: string, { x, y }: { x: number; y: number }): void {
  window.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerId: 1,
      buttons: type === 'pointermove' ? 1 : 0,
    }),
  );
}

function grab(): void {
  const event = new PointerEvent('pointerdown', {
    clientX: PRESS.x,
    clientY: PRESS.y,
    pointerId: 1,
  });
  const root = document.createElement('div');
  startOverviewMove({ store, root, event }, A, { ...PRESS, time: 0 });
}

function frame(time: number): void {
  for (const callback of frames.splice(0)) callback(time);
}

function shownRect() {
  const start = startOf(store.getSnapshot(), A, { ...PRESS, time: 0 });
  if (!start) throw new Error('Pane A is not shown');
  return start.rect;
}

function dragged() {
  const found = store.getSnapshot().overlay?.dragged;
  if (!found) throw new Error('Nothing is dragged');
  return found;
}

function actions(): unknown[] {
  return requests()
    .filter(([url]) => url === '/workspace/actions')
    .map(([, , body]) => body);
}

function scrolledFirst(): number {
  return store.getSnapshot().overlay?.scrolled?.first ?? NaN;
}

function firstViewX(): number | undefined {
  const { strips, metrics } = store.getSnapshot();
  const first = strips.get('first');
  return first && viewXOf(first, metrics);
}

function columnIds(layout = store.getSnapshot().strips.get('first')?.layout) {
  return layout?.columns.map(({ id }) => id);
}

beforeEach(() => {
  fakeCore();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    frames.push(callback),
  );
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  store = new ViewStore(new CoreWorkspace(new CoreEvents().feed('workspace')));
  store.subscribe(() => undefined);
  coreShowsWorkspace(twoAgents());
  store.measure(1200, 800);
  store.overview(true);
});

afterEach(async () => {
  pointer('pointerup', PRESS);
  await new Promise((resolve) => setTimeout(resolve, 20));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('picks a pane that barely moved', async () => {
  grab();
  pointer('pointermove', { x: PRESS.x + 7, y: PRESS.y });
  pointer('pointerup', { x: PRESS.x + 7, y: PRESS.y });
  expect(store.getSnapshot().overview).toBe(false);
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'focusPane', paneId: A }]),
  );
});

test('stops picking once the pane moved eight pixels', async () => {
  grab();
  pointer('pointermove', { x: PRESS.x + 8, y: PRESS.y });
  pointer('pointerup', { x: PRESS.x + 8, y: PRESS.y });
  expect(store.getSnapshot().overview).toBe(true);
  expect(store.getSnapshot().overlay).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([]);
});

test('holds the pane back on a rubber band before it is dragged far enough', () => {
  const rect = shownRect();
  grab();
  pointer('pointermove', { x: PRESS.x + 60, y: PRESS.y + 80 });
  const stretch = 40000 / 65536;
  const factor = (1 - 1 / (stretch / 0.5 + 1)) * 0.5;
  expect(dragged().x).toBeCloseTo(rect.x + 60 * factor, 6);
  expect(dragged().y).toBeCloseTo(rect.y + 80 * factor, 6);
  expect(store.getSnapshot().overlay?.workspaceId).toBe('first');
});

test('lets go of the pane once it is dragged 256 pixels at full size', () => {
  const rect = shownRect();
  grab();
  pointer('pointermove', { x: PRESS.x + 128, y: PRESS.y });
  expect(dragged()).toMatchObject({ x: rect.x + 128, y: rect.y });
  expect(columnIds(store.getSnapshot().overlay?.layout)).toEqual(['right']);
  pointer('pointermove', { x: PRESS.x + 100, y: PRESS.y + 100 });
  expect(dragged()).toMatchObject({ x: rect.x + 100, y: rect.y + 100 });
});

test('keeps the pane where it was dropped until core moves it', async () => {
  const rect = shownRect();
  grab();
  pointer('pointermove', { x: PRESS.x + 200, y: PRESS.y + 100 });
  pointer('pointerup', { x: PRESS.x + 200, y: PRESS.y + 100 });
  expect(columnIds()).toEqual(['right']);
  expect(firstViewX()).toBe(-4);
  expect(dragged()).toMatchObject({ x: rect.x + 200, y: rect.y + 100 });
  await vi.waitFor(() => expect(actions()).toHaveLength(1));
});

test('scrolls the workspaces at the bottom edge no further than the last one', async () => {
  grab();
  pointer('pointermove', { x: 600, y: 799 });
  for (let time = 1100; time <= 3000; time += 100) frame(time);
  expect(store.getSnapshot().renderIndex).toBe(1);
});

test('scrolls a workspace row sideways at full speed despite the zoom', async () => {
  grab();
  pointer('pointermove', { x: 1195, y: 300 });
  const before = scrolledFirst();
  frame(1100);
  const after = scrolledFirst();
  expect(after - before).toBeCloseTo(250, 6);
});

test('keeps the workspace scrolled where the pane was dropped', () => {
  grab();
  pointer('pointermove', { x: 5, y: 300 });
  frame(1100);
  const scrolled = scrolledFirst();
  pointer('pointerup', { x: 5, y: 300 });
  expect(firstViewX()).toBeCloseTo(scrolled, 6);
});

test('lets the workspaces overshoot as far on screen as at full size', () => {
  const event = new PointerEvent('pointerdown', { pointerId: 1, button: 1 });
  const root = document.createElement('div');
  const target = { index: 0, zoom: 0.5, view: false };
  startOverviewPan({ store, root, event }, { ...PRESS, time: 0 }, target);
  pointer('pointermove', { x: PRESS.x, y: PRESS.y - 20 });
  pointer('pointermove', { x: PRESS.x, y: PRESS.y - 10000 });
  const { renderIndex } = store.getSnapshot();
  expect(renderIndex).toBeGreaterThan(1.09);
  expect(renderIndex).toBeLessThan(1.1);
});
