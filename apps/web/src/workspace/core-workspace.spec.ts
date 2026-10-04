import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { A, agent, B, column, strip, viewOf } from '@/test/fake-core';
import {
  FakeEventSource,
  fakeEventSources,
  requests,
} from '@/test/fake-event-source';
import { agentOf, CoreWorkspace, type WorkspaceView } from './core-workspace';

const view: Omit<WorkspaceView, 'loaded'> = viewOf(
  [strip('first', [column('only', [A])])],
  [agent(A, 'agent 1')],
);

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
    workspaces: [],
    activeWorkspace: 0,
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
  await workspace.openPane();
  await workspace.open(B, 'excalidraw');
  await workspace.act({ action: 'focusColumnRight' });
  await workspace.rename(A, 'planner');
  await workspace.close(B);
  expect(requests()).toEqual([
    ['/workspace/panes', 'POST', undefined],
    [`/workspace/panes/${B}/content`, 'PUT', { kind: 'excalidraw' }],
    ['/workspace/actions', 'POST', { action: 'focusColumnRight' }],
    [`/workspace/panes/${A}`, 'PATCH', { name: 'planner' }],
    [`/workspace/panes/${B}`, 'DELETE', undefined],
  ]);
  expect(vi.mocked(window.fetch).mock.calls[0]?.[1]?.headers).toEqual({
    'Content-Type': 'application/json',
  });
});

test('sends layout actions one after another, even after a refusal', async () => {
  const replies: ((response: Response) => void)[] = [];
  vi.mocked(window.fetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        replies.push(resolve);
      }),
  );
  const workspace = new CoreWorkspace();
  const first = workspace.act({ action: 'focusWindowUp' });
  const second = workspace.act({ action: 'focusWindowDown' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(requests()).toHaveLength(1);
  replies[0](new Response(null, { status: 500 }));
  await expect(first).rejects.toThrow('replied with status 500');
  await second;
  expect(requests()).toEqual([
    ['/workspace/actions', 'POST', { action: 'focusWindowUp' }],
    ['/workspace/actions', 'POST', { action: 'focusWindowDown' }],
  ]);
});

test('shows a voice change before core confirms it', async () => {
  const workspace = new CoreWorkspace();
  const voiced = workspace.setVoice(B);
  expect(workspace.getSnapshot().voiceAgentId).toBe(B);
  await voiced;
  expect(requests()).toEqual([['/workspace/voice', 'PUT', { agentId: B }]]);
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
  const found = { id: A, kind: 'agent' as const, name: 'a', working: false };
  const both = {
    ...view,
    loaded: true,
    panes: [found, { id: B, kind: 'excalidraw' as const }],
  };
  expect(agentOf(both, A)).toBe(found);
  expect(agentOf(both, B)).toBeNull();
  expect(agentOf(both, 'nobody')).toBeNull();
});
