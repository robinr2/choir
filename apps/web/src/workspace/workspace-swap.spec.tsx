import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from '@/App';
import { CoreCanvas } from '@/canvas/core-canvas';
import {
  A,
  B,
  coreShowsWorkspace,
  fakeCore,
  twoAgents,
} from '@/test/fake-core';
import {
  dragEvent,
  micOf,
  pane,
  renderApp,
  type Screen,
} from '@/test/render-app';
import { createPipecatClient } from '@/voice/create-pipecat-client';
import { CoreWorkspace } from './core-workspace';

async function swapWorkspace(screen: Screen) {
  const workspace = new CoreWorkspace();
  const client = createPipecatClient();
  const stop = workspace.subscribe(() => undefined);
  coreShowsWorkspace(twoAgents());
  await screen.rerender(
    <App client={client} workspace={workspace} canvas={new CoreCanvas()} />,
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
  const actions = {
    addAtEdge: vi.spyOn(workspace, 'addAtEdge'),
    split: vi.spyOn(workspace, 'split'),
    close: vi.spyOn(workspace, 'close'),
    swap: vi.spyOn(workspace, 'swap'),
    resize: vi.spyOn(workspace, 'resize'),
  };
  await screen.getByRole('button', { name: 'Add a row at the top' }).click();
  await pane(screen, 'agent 1')
    .getByRole('button', { name: 'Split vertically' })
    .click();
  await pane(screen, 'agent 2').getByRole('button', { name: 'Close' }).click();
  const data = new DataTransfer();
  pane(screen, 'agent 1')
    .element()
    .querySelector('[data-slot="pane-title"]')
    ?.dispatchEvent(dragEvent('dragstart', data));
  pane(screen, 'agent 2').element().dispatchEvent(dragEvent('dragover', data));
  pane(screen, 'agent 2').element().dispatchEvent(dragEvent('drop', data));
  const bar = document.querySelector('.mosaic-split');
  const box = bar?.getBoundingClientRect() ?? new DOMRect();
  const at = (clientX: number) => ({
    bubbles: true,
    clientX,
    clientY: box.top,
  });
  bar?.dispatchEvent(new MouseEvent('mousedown', at(box.left)));
  document.dispatchEvent(new MouseEvent('mouseup', at(box.left - 50)));
  await vi.waitFor(() => {
    expect(actions.addAtEdge).toHaveBeenCalledWith('top');
    expect(actions.split).toHaveBeenCalledWith(A, 'vertical');
    expect(actions.close).toHaveBeenCalledWith(B);
    expect(actions.swap).toHaveBeenCalledWith(A, B);
    expect(actions.resize).toHaveBeenCalled();
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
