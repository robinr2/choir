import { expect, test, vi } from 'vitest';
import { CoreAgents } from '@/agents/core-agents';
import { CoreRateLimits } from '@/agents/core-rate-limits';
import App from '@/App';
import { CoreCanvas } from '@/canvas/core-canvas';
import { CoreEvents } from '@/lib/core-events';
import { coreShowsWorkspace, twoAgents } from '@/test/fake-core';
import { N1, notification, T1, T2, todo } from '@/test/fake-inbox';
import {
  agentZone,
  dragFrom,
  rowOf,
  showInbox,
  withFakeCore,
} from '@/test/inbox-screen';
import { client, dragEvent, type Screen } from '@/test/render-app';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { CoreInbox } from './core-inbox';

const INBOX = {
  notifications: [notification()],
  todos: [todo(), todo({ id: T2, title: 'Second' })],
};

async function swapInbox(screen: Screen) {
  const events = new CoreEvents();
  const inbox = new CoreInbox(events.feed('inbox'));
  const workspace = new CoreWorkspace(events.feed('workspace'));
  const stop = workspace.subscribe(() => undefined);
  coreShowsWorkspace(twoAgents());
  await screen.rerender(
    <App
      client={client}
      events={events}
      workspace={workspace}
      canvas={new CoreCanvas()}
      inbox={inbox}
      agents={new CoreAgents()}
      rateLimits={new CoreRateLimits(events.feed('rate-limits'))}
    />,
  );
  stop();
  return inbox;
}

async function opened(list?: string) {
  const { screen, inbox: sidebar } = await showInbox(INBOX, list);
  const title = list ? 'Production is down' : 'Check the logs';
  await expect
    .element(screen.getByRole('article', { name: title }))
    .toBeVisible();
  return { screen, sidebar };
}

withFakeCore();

test('moves and hands over entries through the inbox it was last given', async () => {
  const { screen } = await opened();
  const inbox = await swapInbox(screen);
  const move = vi.spyOn(inbox, 'move');
  const archive = vi.spyOn(inbox, 'archive');
  const data = dragFrom(screen, 'Second');
  const first = rowOf(screen, 'Check the logs');
  first.dispatchEvent(dragEvent('dragover', data));
  first.dispatchEvent(dragEvent('drop', data));
  agentZone(screen, 'agent 1').zone.dispatchEvent(
    dragEvent('drop', dragFrom(screen, 'Second')),
  );
  await vi.waitFor(() => {
    expect(move).toHaveBeenCalledWith('todos', T2, { before: T1 });
    expect(archive).toHaveBeenCalledWith('todos', T2, true);
  });
});

test('links through the inbox it was last given, even with the menu open', async () => {
  const { screen, sidebar } = await opened('Notifications');
  await sidebar.getByRole('button', { name: 'Add to to-do' }).click();
  await expect
    .element(screen.getByRole('menuitem', { name: 'Check the logs' }))
    .toBeVisible();
  const inbox = await swapInbox(screen);
  const link = vi.spyOn(inbox, 'link');
  await screen.getByRole('menuitem', { name: 'Check the logs' }).click();
  await vi.waitFor(() => expect(link).toHaveBeenCalledWith(T1, N1));
});

test('saves a to-do through the inbox it was last given, even with the to-do open', async () => {
  const { screen, sidebar } = await opened();
  await sidebar.getByRole('button', { name: /Check the logs/ }).click();
  const dialog = screen.getByRole('dialog', { name: 'Check the logs' });
  await expect
    .element(dialog.getByRole('textbox', { name: 'Title' }))
    .toBeVisible();
  const inbox = await swapInbox(screen);
  const update = vi.spyOn(inbox, 'updateTodo');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await vi.waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      T1,
      expect.objectContaining({ title: 'Check the logs' }),
    ),
  );
  await expect.element(dialog).not.toBeInTheDocument();
});

test('creates a to-do through the inbox it was last given, even with the form open', async () => {
  const { screen, sidebar } = await opened();
  await sidebar.getByRole('button', { name: 'New to-do' }).click();
  const dialog = screen.getByRole('dialog', { name: 'New to-do' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Call Anna');
  const inbox = await swapInbox(screen);
  const create = vi.spyOn(inbox, 'createTodo');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await vi.waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Call Anna' }),
    ),
  );
  await expect.element(dialog).not.toBeInTheDocument();
});
