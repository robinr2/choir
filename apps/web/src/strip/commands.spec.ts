import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoreEvents } from '@/lib/core-events';
import {
  A,
  column,
  coreShowsWorkspace,
  fakeCore,
  strip,
  twoAgents,
  viewOf,
} from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { expand, fullyVisible, run } from './commands';
import { ViewStore } from './view-store';

const metrics = { width: 1000, height: 800, gap: 4 };

function listening(): ViewStore {
  const store = new ViewStore(
    new CoreWorkspace(new CoreEvents().feed('workspace')),
  );
  store.subscribe(() => undefined);
  store.measure(1000, 800);
  return store;
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('opens a new pane, closes the focused one and sends layout actions', async () => {
  const store = listening();
  coreShowsWorkspace(twoAgents());
  await run(store, 'open');
  await run(store, 'close');
  await run(store, { action: 'moveWorkspaceUp' });
  expect(requests()).toEqual([
    ['/workspace/panes', 'POST', undefined],
    [`/workspace/panes/${A}`, 'DELETE', undefined],
    ['/workspace/actions', 'POST', { action: 'moveWorkspaceUp' }],
  ]);
});

test('closes nothing before core shows any workspace', async () => {
  const store = listening();
  await run(store, 'close');
  expect(requests()).toEqual([]);
});

const thirds = [0, 1, 2, 3].map((index) =>
  column(`c${index}`, [`p${index}`], { width: 0.3 }),
);

function shown(viewX: number) {
  return fullyVisible({ layout: strip('w', thirds), viewX }, metrics).map(
    (entry) => entry.column.id,
  );
}

test('finds the columns that are fully on screen', () => {
  expect(shown(-4)).toEqual(['c0', 'c1', 'c2']);
  expect(shown(-3)).toEqual(['c1', 'c2']);
  expect(shown(294.8)).toEqual(['c1', 'c2', 'c3']);
  expect(shown(294.9)).toEqual(['c2', 'c3']);
  expect(shown(5000)).toEqual([]);
  expect(shown(-105)).toEqual(['c0', 'c1']);
  const wide = strip('w', [column('x', ['p'], { width: 2 })]);
  expect(fullyVisible({ layout: wide, viewX: -4 }, metrics)).toEqual([]);
});

test('anchors the leftmost visible column when the focused one will widen', async () => {
  const store = listening();
  const anchor = vi.spyOn(store, 'anchor');
  const layout = strip('first', thirds, { activeColumn: 1 });
  coreShowsWorkspace(viewOf([layout], []));
  await expand(store);
  expect(anchor).toHaveBeenCalledExactlyOnceWith({
    workspaceId: 'first',
    columnId: 'c1',
    width: 0.3,
  });
  expect(requests()).toEqual([
    [
      '/workspace/actions',
      'POST',
      {
        action: 'expandColumnToAvailableWidth',
        visibleColumns: ['c1', 'c2', 'c3'],
      },
    ],
  ]);
});

test('anchors nothing when the focused column will not widen', async () => {
  const store = listening();
  const anchor = vi.spyOn(store, 'anchor');
  let count = 0;
  const show = (columns: typeof thirds, activeColumn: number) => {
    count += 1;
    const layout = strip(`ws${count}`, columns, { activeColumn });
    coreShowsWorkspace(viewOf([layout], []));
    return expand(store);
  };
  await show([thirds[0]], 0);
  await show([{ ...thirds[0], fullWidth: true }, thirds[1]], 0);
  const halves = [0, 1].map((index) => column(`h${index}`, [`q${index}`]));
  await show(halves, 0);
  store.show({ viewX: 294.8 });
  await show(thirds, 0);
  store.show(null);
  expect(anchor).not.toHaveBeenCalled();
  await show(thirds.slice(0, 2), 0);
  expect(anchor).toHaveBeenCalledOnce();
  expect(requests()).toHaveLength(5);
});

test('expands nothing on an empty workspace', async () => {
  const store = listening();
  coreShowsWorkspace(viewOf([], []));
  await expand(store);
  await expand(
    new ViewStore(new CoreWorkspace(new CoreEvents().feed('workspace'))),
  );
  expect(requests()).toEqual([]);
});
