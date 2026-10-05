import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoreAgents } from '@/agents/core-agents';
import { CoreRateLimits } from '@/agents/core-rate-limits';
import App from '@/App';
import { CoreCanvas } from '@/canvas/core-canvas';
import { CoreInbox } from '@/inbox/core-inbox';
import {
  A,
  B,
  coreShowsWorkspace,
  fakeCore,
  twoAgents,
} from '@/test/fake-core';
import { userEvent } from 'vitest/browser';
import { micOf, pane, renderApp, type Screen } from '@/test/render-app';
import { createPipecatClient } from '@/voice/create-pipecat-client';
import { CoreWorkspace, type WorkspaceView } from './core-workspace';

async function swapWorkspace(
  screen: Screen,
  view: Omit<WorkspaceView, 'loaded'> = twoAgents(),
) {
  const workspace = new CoreWorkspace();
  const client = createPipecatClient();
  const stop = workspace.subscribe(() => undefined);
  coreShowsWorkspace(view);
  await screen.rerender(
    <App
      client={client}
      workspace={workspace}
      canvas={new CoreCanvas()}
      inbox={new CoreInbox()}
      agents={new CoreAgents()}
      rateLimits={new CoreRateLimits()}
    />,
  );
  stop();
  return { workspace, client };
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('acts on the workspace it was last given', async () => {
  const screen = await renderApp();
  const { workspace } = await swapWorkspace(screen);
  const close = vi.spyOn(workspace, 'close');
  const act = vi.spyOn(workspace, 'act');
  await pane(screen, 'agent 2').getByRole('button', { name: 'Close' }).click();
  await userEvent.keyboard('{Alt>}j{/Alt}');
  await vi.waitFor(() => {
    expect(close).toHaveBeenCalledWith(B);
    expect(act).toHaveBeenCalledWith({ action: 'focusWindowDown' });
  });
});

test('talks through the client and workspace it was last given', async () => {
  const screen = await renderApp();
  const { workspace, client } = await swapWorkspace(screen);
  const setVoice = vi.spyOn(workspace, 'setVoice');
  const connect = vi.spyOn(client, 'connect').mockResolvedValue({
    version: '1.0.0',
  });
  const disconnect = vi.spyOn(client, 'disconnect').mockResolvedValue();
  await micOf(screen, 'agent 2').click();
  await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce());
  expect(setVoice).toHaveBeenCalledWith(B);
  coreShowsWorkspace(twoAgents(null));
  await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
});

test('opens panes in the workspace it was last given', async () => {
  const withEmptyPane: Omit<WorkspaceView, 'loaded'> = {
    ...twoAgents(),
    panes: [
      { id: A, kind: 'agent', name: 'agent 1', working: false },
      { id: B, kind: 'empty' },
    ],
  };
  const screen = await renderApp(withEmptyPane);
  const { workspace } = await swapWorkspace(screen, withEmptyPane);
  const openCanvas = vi.spyOn(workspace, 'openCanvas');
  await pane(screen, 'New pane')
    .getByRole('button', { name: 'Excalidraw' })
    .click();
  await vi.waitFor(() => expect(openCanvas).toHaveBeenCalledWith(B));
});
