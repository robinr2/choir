import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoreEvents } from '@/lib/core-events';
import {
  agent,
  column,
  coreShowsWorkspace,
  fakeCore,
  strip,
  twoAgents,
  viewOf,
} from '@/test/fake-core';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { viewXOf } from './geometry';
import { ViewStore } from './view-store';

function storeWithListener() {
  const store = new ViewStore(
    new CoreWorkspace(new CoreEvents().feed('workspace')),
  );
  const listener = vi.fn<() => void>();
  const stop = store.subscribe(listener);
  return { store, listener, stop };
}

function viewX(store: ViewStore, id = 'first') {
  const { strips, metrics } = store.getSnapshot();
  const found = strips.get(id);
  return found && viewXOf(found, metrics);
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('follows the workspaces core shows', () => {
  const { store, listener, stop } = storeWithListener();
  expect(store.getSnapshot().strips.size).toBe(0);
  coreShowsWorkspace({ ...twoAgents(), activeWorkspace: 1 });
  expect(listener).toHaveBeenCalledOnce();
  const snapshot = store.getSnapshot();
  expect(snapshot).toBe(store.getSnapshot());
  expect([...snapshot.strips.keys()]).toEqual(['first', 'last']);
  expect(snapshot.renderIndex).toBe(1);
  expect(snapshot.gesture).toBeNull();
  expect(snapshot.overlay).toBeNull();
  stop();
  coreShowsWorkspace(twoAgents());
  store.show(null);
  expect(listener).toHaveBeenCalledOnce();
});

test('fits the views again when the strip is measured', () => {
  const { store, listener } = storeWithListener();
  coreShowsWorkspace(twoAgents());
  expect(viewX(store)).toBe(0);
  store.measure(1000, 800);
  expect(store.getSnapshot().metrics).toEqual({
    width: 1000,
    height: 800,
    gap: 4,
  });
  expect(viewX(store)).toBe(-4);
  expect(listener).toHaveBeenCalledTimes(2);
});

test('shows gestures on top of what core says', () => {
  const { store, listener } = storeWithListener();
  coreShowsWorkspace(twoAgents());
  store.show({ viewX: 40 });
  store.grab('grabbing');
  store.scrollWorkspaces(0.5);
  expect(store.getSnapshot()).toMatchObject({
    overlay: { viewX: 40 },
    gesture: 'grabbing',
    renderIndex: 0.5,
  });
  expect(listener).toHaveBeenCalledTimes(4);
  coreShowsWorkspace(twoAgents());
  expect(store.getSnapshot()).toMatchObject({
    overlay: { viewX: 40 },
    renderIndex: 0,
  });
});

test('takes over the view a gesture ends with', () => {
  const { store } = storeWithListener();
  store.measure(1000, 800);
  coreShowsWorkspace(twoAgents());
  store.show({ viewX: 40 });
  const moved = strip('first', [column('right', ['b'])]);
  store.commit(moved, 100);
  const snapshot = store.getSnapshot();
  expect(snapshot.overlay).toBeNull();
  expect(snapshot.strips.get('first')).toEqual({
    layout: moved,
    offset: -4,
    saved: 0,
  });
  store.commit(strip('new', [column('n', ['c'])]), 0);
  expect(store.getSnapshot().strips.get('new')?.saved).toBe(0);
});

test('keeps the saved view of a strip a gesture ends on', () => {
  const { store } = storeWithListener();
  store.measure(1000, 800);
  const one = strip('first', [column('left', ['a'])]);
  coreShowsWorkspace(viewOf([one], [agent('a', 'a')]));
  const opened = strip(
    'first',
    [column('left', ['a']), column('right', ['b'])],
    {
      activeColumn: 1,
      restoresPrevious: true,
    },
  );
  coreShowsWorkspace(viewOf([opened], [agent('a', 'a'), agent('b', 'b')]));
  store.commit(opened, 0);
  expect(store.getSnapshot().strips.get('first')?.saved).toBe(-4);
});

test('puts the leftmost visible column at the edge after expanding', () => {
  const { store } = storeWithListener();
  store.measure(1000, 800);
  const columns = [
    column('a', ['p'], { width: 0.3 }),
    column('b', ['q'], { width: 0.3 }),
    column('c', ['r'], { width: 0.3 }),
  ];
  const layout = strip('first', columns, { activeColumn: 1 });
  coreShowsWorkspace(viewOf([layout], []));
  store.commit(layout, 100);
  store.anchor({ workspaceId: 'first', columnId: 'b', width: 0.3 });
  coreShowsWorkspace(viewOf([layout], []));
  expect(viewX(store)).toBe(100);
  const wider = columns.with(1, { ...columns[1], width: 0.4 });
  coreShowsWorkspace(viewOf([{ ...layout, columns: wider }], []));
  expect(viewX(store)).toBe(298.8 - 4);
  coreShowsWorkspace(viewOf([{ ...layout, columns: columns }], []));
  expect(viewX(store)).toBe(294.8);
  store.commit({ ...layout, columns: wider }, 150);
  coreShowsWorkspace(viewOf([{ ...layout, columns: wider }], []));
  expect(viewX(store)).toBe(150);
});

test('forgets the anchor only once it moved the view', () => {
  const { store } = storeWithListener();
  store.measure(1000, 800);
  const layout = strip('first', [column('a', ['p'])]);
  coreShowsWorkspace(viewOf([layout], []));
  store.anchor({ workspaceId: 'gone', columnId: 'a', width: 0.5 });
  coreShowsWorkspace(viewOf([layout], []));
  store.anchor({ workspaceId: 'first', columnId: 'gone', width: 0.4 });
  coreShowsWorkspace(viewOf([layout], []));
  expect(viewX(store)).toBe(-4);
  store.anchor({ workspaceId: 'first', columnId: 'a', width: 0.4 });
  coreShowsWorkspace(viewOf([strip('first', [])], []));
  coreShowsWorkspace(viewOf([layout], []));
  expect(viewX(store)).toBe(-4);
});

test('opens and closes the overview, optionally on another workspace', () => {
  const { store, listener } = storeWithListener();
  coreShowsWorkspace(twoAgents());
  expect(store.getSnapshot().overview).toBe(false);
  store.overview(true);
  expect(store.getSnapshot()).toMatchObject({ overview: true, renderIndex: 0 });
  store.overview(false, 1);
  expect(store.getSnapshot()).toMatchObject({
    overview: false,
    renderIndex: 1,
  });
  expect(listener).toHaveBeenCalledTimes(3);
});
