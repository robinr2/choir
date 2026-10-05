import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CATALOG, coreHasSessions, session } from '@/test/fake-agents';
import { fakeCore } from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { CoreAgents } from './core-agents';

let agents: CoreAgents;

beforeEach(() => {
  fakeCore();
  agents = new CoreAgents();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('reads the catalog from core once', async () => {
  expect(await agents.catalog()).toEqual(CATALOG);
  expect(await agents.catalog()).toEqual(CATALOG);
  expect(requests()).toEqual([['/agent-catalog', 'GET', undefined]]);
});

test('lists, deletes and lists the sessions again', async () => {
  coreHasSessions([session()]);
  expect(await agents.sessions()).toEqual([session()]);
  await agents.deleteSession('s1');
  expect(await agents.sessions()).toEqual([session()]);
  expect(requests()).toEqual([
    ['/agent-sessions', 'GET', undefined],
    ['/agent-sessions/s1', 'DELETE', undefined],
    ['/agent-sessions', 'GET', undefined],
  ]);
});

test('lists the folders in a folder', async () => {
  expect(await agents.folders('/home/sam')).toEqual({
    path: '/home/sam',
    parent: null,
    folders: [
      { name: 'choir', path: '/home/sam/choir' },
      { name: 'notes', path: '/home/sam/notes' },
    ],
  });
  expect(requests()).toEqual([
    ['/folders?path=%2Fhome%2Fsam', 'GET', undefined],
  ]);
});
