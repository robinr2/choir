import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { A, B } from '@/test/fake-core';
import {
  FakeEventSource,
  fakeEventSources,
  requests,
} from '@/test/fake-event-source';
import { agentOf, CoreWorkspace, type WorkspaceView } from './core-workspace';

const view: Omit<WorkspaceView, 'loaded'> = {
  layout: A,
  panes: [{ id: A, kind: 'agent', name: 'agent 1', working: false }],
  voiceAgentId: null,
};

beforeEach(() => {
  fakeEventSources();
  vi.spyOn(window, 'fetch').mockImplementation(async () => {
    return new Response(null, { status: 204 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('follows the workspace core streams', () => {
  const workspace = new CoreWorkspace();
  expect(workspace.getSnapshot()).toEqual({
    loaded: false,
    layout: null,
    panes: [],
    voiceAgentId: null,
  });
  const listener = vi.fn<() => void>();
  const unsubscribe = workspace.subscribe(listener);
  const [source] = FakeEventSource.opened;
  expect(source?.url).toBe('/workspace/events');
  source?.receive(view);
  expect(workspace.getSnapshot()).toEqual({ ...view, loaded: true });
  expect(listener).toHaveBeenCalledOnce();
  unsubscribe();
});

test('asks core to change the layout', async () => {
  const workspace = new CoreWorkspace();
  await workspace.split(A, 'vertical');
  await workspace.addAtEdge('top');
  await workspace.open(B, 'excalidraw');
  await workspace.swap(A, B);
  await workspace.rename(A, 'planner');
  await workspace.close(B);
  expect(requests()).toEqual([
    ['/workspace/splits', 'POST', { paneId: A, direction: 'vertical' }],
    ['/workspace/edges', 'POST', { edge: 'top' }],
    [`/workspace/panes/${B}/content`, 'PUT', { kind: 'excalidraw' }],
    ['/workspace/swaps', 'POST', { first: A, second: B }],
    [`/workspace/panes/${A}`, 'PATCH', { name: 'planner' }],
    [`/workspace/panes/${B}`, 'DELETE', undefined],
  ]);
  expect(vi.mocked(window.fetch).mock.calls[0]?.[1]?.headers).toEqual({
    'Content-Type': 'application/json',
  });
});

test('shows a resize and a voice change before core confirms them', async () => {
  const workspace = new CoreWorkspace();
  const layout = {
    type: 'split' as const,
    direction: 'row' as const,
    children: [A, B],
    splitPercentages: [30, 70],
  };
  const resized = workspace.resize(layout);
  expect(workspace.getSnapshot().layout).toEqual(layout);
  await resized;
  const voiced = workspace.setVoice(B);
  expect(workspace.getSnapshot().voiceAgentId).toBe(B);
  await voiced;
  expect(requests()).toEqual([
    ['/workspace/layout', 'PUT', { layout }],
    ['/workspace/voice', 'PUT', { agentId: B }],
  ]);
});

test('fails when core refuses a change', async () => {
  vi.mocked(window.fetch).mockResolvedValue(
    new Response(null, { status: 404 }),
  );
  await expect(new CoreWorkspace().close(A)).rejects.toThrow(
    `DELETE /workspace/panes/${A} replied with status 404`,
  );
});

test('finds only agents by their ID', () => {
  const agent = { id: A, kind: 'agent' as const, name: 'a', working: false };
  const both = {
    ...view,
    loaded: true,
    panes: [agent, { id: B, kind: 'excalidraw' as const }],
  };
  expect(agentOf(both, A)).toBe(agent);
  expect(agentOf(both, B)).toBeNull();
  expect(agentOf(both, 'nobody')).toBeNull();
});
