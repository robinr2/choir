import { beforeEach, expect, test } from 'vitest';
import {
  A,
  B,
  agent,
  column,
  coreShowsWorkspace,
  fakeCore,
  strip,
  viewOf,
} from '@/test/fake-core';
import { CoreEvents } from '@/lib/core-events';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { placements } from './placements';
import { ViewStore } from './view-store';

let store: ViewStore;

function showTwoWorkspaces(activeWorkspace: number): void {
  coreShowsWorkspace(
    viewOf(
      [
        strip('first', [column('left', [A])]),
        strip('second', [column('right', [B])]),
      ],
      [agent(A, 'agent 1'), agent(B, 'agent 2')],
      { activeWorkspace },
    ),
  );
}

function draggedOn(workspaceId?: string): string | undefined {
  store.show({
    workspaceId,
    dragged: { paneId: B, x: 10, y: 10, width: 100, height: 100 },
  });
  return placements(store.getSnapshot()).find(({ dragged }) => dragged)
    ?.workspaceId;
}

beforeEach(() => {
  fakeCore();
  store = new ViewStore(new CoreWorkspace(new CoreEvents().feed('workspace')));
  store.subscribe(() => undefined);
  store.measure(1200, 800);
});

test('draws a dragged pane on the workspace it is dragged on', async () => {
  showTwoWorkspaces(0);
  await expect.poll(() => store.getSnapshot().strips.size).toBe(3);
  expect(draggedOn('second')).toBe('second');
});

test('draws a dragged pane on the first workspace when it is dragged there', async () => {
  showTwoWorkspaces(1);
  await expect.poll(() => store.getSnapshot().strips.size).toBe(3);
  expect(draggedOn('first')).toBe('first');
});

test('draws a dragged pane on the focused workspace when none is named', async () => {
  showTwoWorkspaces(1);
  await expect.poll(() => store.getSnapshot().strips.size).toBe(3);
  expect(draggedOn()).toBe('second');
  expect(draggedOn('nowhere')).toBe('second');
});
