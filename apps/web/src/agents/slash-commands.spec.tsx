import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { ConversationState } from '@/conversation/core-conversation';
import {
  coreHasSessions,
  OTHER_SESSION,
  session,
  SESSION,
} from '@/test/fake-agents';
import { A, coreShowsConversation, fakeCore } from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { pane, renderApp, type Screen } from '@/test/render-app';

const COMMANDS = [
  { name: 'compact', description: 'Compact the conversation', hint: null },
  { name: 'branch', description: 'Branch into a new session', hint: '[name]' },
  { name: 'resume', description: 'Resume a session', hint: '[session id]' },
];

function composer(screen: Screen) {
  return pane(screen, 'agent 1').getByRole('textbox', {
    name: 'Message input',
  });
}

function sent(path: string) {
  return requests()
    .filter(([url]) => url === `/conversations/${A}/${path}`)
    .map(([, , body]) => body);
}

function turns() {
  return sent('queue');
}

async function showChat(change: Partial<ConversationState> = {}) {
  const screen = await renderApp();
  coreShowsConversation(A, {
    commands: COMMANDS,
    session: { id: SESSION, title: 'Now', cwd: '/home/sam' },
    ...change,
  });
  await composer(screen).click();
  return screen;
}

beforeEach(async () => {
  fakeCore();
  await page.viewport(1256, 900);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('lists the commands of the session when typing a slash', async () => {
  const screen = await showChat();
  await userEvent.keyboard('/');
  const popover = pane(screen, 'agent 1').getByRole('listbox');
  await expect
    .element(popover)
    .toHaveTextContent(
      /\/compactCompact the conversation\/branch\[name\]Branch into a new session/,
    );
  await userEvent.keyboard('bra');
  await expect.element(popover.getByRole('option')).toHaveTextContent(/branch/);
  await userEvent.keyboard('nchx');
  await expect.element(popover).toHaveTextContent('No matching commands');
});

test('inserts a command that takes arguments and sends it on Enter', async () => {
  const screen = await showChat();
  await userEvent.keyboard('/br');
  await userEvent.keyboard('{Enter}');
  await expect.element(composer(screen)).toHaveValue('/branch ');
  expect(turns()).toEqual([]);
  await userEvent.keyboard('fix{Enter}');
  await vi.waitFor(() =>
    expect(turns()).toEqual([{ text: '/branch fix', images: [] }]),
  );
});

test('sends a command without arguments as soon as it is chosen', async () => {
  const screen = await showChat();
  await userEvent.keyboard('/');
  await pane(screen, 'agent 1')
    .getByRole('option', { name: /compact/ })
    .click();
  await vi.waitFor(() =>
    expect(turns()).toEqual([{ text: '/compact ', images: [] }]),
  );
});

test('queues a command without arguments behind the running turn', async () => {
  const screen = await showChat({ status: { state: 'working', since: 0 } });
  await userEvent.keyboard('/');
  await pane(screen, 'agent 1')
    .getByRole('option', { name: /compact/ })
    .click();
  await vi.waitFor(() =>
    expect(turns()).toEqual([{ text: '/compact ', images: [] }]),
  );
  expect(sent('steerings')).toEqual([]);
});

test('resumes a session picked from the list', async () => {
  coreHasSessions([
    session(),
    session({ sessionId: OTHER_SESSION, title: 'Older work' }),
  ]);
  const screen = await showChat();
  await userEvent.keyboard('/resu{Enter}');
  const dialog = page.getByRole('dialog', { name: 'Resume a session' });
  await expect.element(dialog.getByText('Older work')).toBeVisible();
  await expect
    .element(dialog.getByText('Fix the login bug'))
    .not.toBeInTheDocument();
  await expect
    .element(dialog.getByRole('button', { name: /Delete/ }))
    .not.toBeInTheDocument();
  await dialog.getByRole('button', { name: /Older work/ }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  await vi.waitFor(() =>
    expect(turns()).toEqual([{ text: `/resume ${OTHER_SESSION}`, images: [] }]),
  );
  await composer(screen).fill('/resume');
  await pane(screen, 'agent 1')
    .getByRole('button', { name: 'Send message' })
    .click();
  await expect.element(dialog).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
  expect(turns()).toHaveLength(1);
});
