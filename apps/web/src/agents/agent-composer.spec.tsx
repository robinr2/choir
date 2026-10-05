import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { ConversationState } from '@/conversation/core-conversation';
import { CATALOG, coreShowsRateLimits } from '@/test/fake-agents';
import { A, coreShowsConversation, fakeCore } from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { pane, renderApp, type Screen } from '@/test/render-app';

function chat(screen: Screen) {
  return pane(screen, 'agent 1');
}

function composer(screen: Screen) {
  return chat(screen).getByRole('textbox', { name: 'Message input' });
}

function sent(path: string) {
  return requests()
    .filter(([url]) => url === `/conversations/${A}/${path}`)
    .map(([, , body]) => body);
}

async function showChat(change: Partial<ConversationState> = {}) {
  const screen = await renderApp();
  coreShowsConversation(A, change);
  return screen;
}

const WORKING = { status: { state: 'working', since: 0 } } as const;

beforeEach(async () => {
  fakeCore();
  await page.viewport(1256, 900);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('sends a message with Enter while the agent is idle', async () => {
  const screen = await showChat();
  await composer(screen).fill('hello');
  await userEvent.keyboard('{Enter}');
  await vi.waitFor(() =>
    expect(sent('user-turns')).toEqual([{ text: 'hello', images: [] }]),
  );
  await expect.element(composer(screen)).toHaveValue('');
});

test('queues a message while the agent works and lets it go or steer', async () => {
  const screen = await showChat(WORKING);
  await composer(screen).fill('next');
  await chat(screen).getByRole('button', { name: 'Queue message' }).click();
  await vi.waitFor(() =>
    expect(sent('user-turns')).toEqual([{ text: 'next', images: [] }]),
  );
  await composer(screen).fill('and then');
  await userEvent.keyboard('{Enter}');
  await vi.waitFor(() => expect(sent('user-turns')).toHaveLength(2));
  expect(sent('steerings')).toEqual([]);
  coreShowsConversation(A, {
    ...WORKING,
    queue: [
      { id: 'q1', text: 'next', images: 0 },
      { id: 'q2', text: 'after that', images: 0 },
    ],
  });
  const queued = chat(screen).getByRole('list', { name: 'Queued messages' });
  await expect.element(queued).toHaveTextContent(/next.*after that/);
  await expect.element(chat(screen).getByText('2 queued')).toBeVisible();
  await queued
    .getByRole('listitem')
    .nth(1)
    .getByRole('button', { name: 'Remove from queue' })
    .click();
  await queued
    .getByRole('listitem')
    .first()
    .getByRole('button', { name: 'Steer into the running turn' })
    .click();
  await vi.waitFor(() =>
    expect(requests().filter(([url]) => url.includes('/queue/'))).toEqual([
      [`/conversations/${A}/queue/q2`, 'DELETE', undefined],
      [`/conversations/${A}/queue/q1/steering`, 'POST', undefined],
    ]),
  );
});

test('steers into the running turn with Ctrl+Enter', async () => {
  const screen = await showChat(WORKING);
  await composer(screen).fill('faster please');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await vi.waitFor(() =>
    expect(sent('steerings')).toEqual([{ text: 'faster please', images: [] }]),
  );
  await composer(screen).fill('also this');
  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
  await vi.waitFor(() => expect(sent('steerings')).toHaveLength(2));
  await composer(screen).fill('not yet');
  await userEvent.keyboard('{Control>}b{/Control}');
  expect(sent('steerings')).toHaveLength(2);
  expect(sent('user-turns')).toEqual([]);
});

test('starts a turn by steering when the agent is idle', async () => {
  const screen = await showChat();
  await composer(screen).fill('go');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await vi.waitFor(() =>
    expect(sent('steerings')).toEqual([{ text: 'go', images: [] }]),
  );
  expect(sent('user-turns')).toEqual([]);
});

test('steers the first queued message with Ctrl+Enter in an empty composer', async () => {
  const screen = await showChat(WORKING);
  await composer(screen).click();
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  coreShowsConversation(A, {
    ...WORKING,
    queue: [
      { id: 'q1', text: 'first', images: 0 },
      { id: 'q2', text: 'second', images: 0 },
    ],
  });
  await expect.element(chat(screen).getByText('2 queued')).toBeVisible();
  await userEvent.keyboard('{Shift>}{Control>}{Enter}{/Control}{/Shift}');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await vi.waitFor(() =>
    expect(requests().filter(([url]) => url.includes('/queue/'))).toEqual([
      [`/conversations/${A}/queue/q1/steering`, 'POST', undefined],
    ]),
  );
  expect(sent('steerings')).toEqual([]);
});

test('stops the running turn', async () => {
  const screen = await showChat(WORKING);
  await chat(screen).getByRole('button', { name: 'Stop generating' }).click();
  await vi.waitFor(() => expect(sent('cancellation')).toEqual([undefined]));
});

test('sends pasted images with the message after showing them', async () => {
  const screen = await showChat();
  const clipboard = new DataTransfer();
  clipboard.items.add(new File(['png'], 'shot.png', { type: 'image/png' }));
  composer(screen)
    .element()
    .dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    );
  await expect
    .element(chat(screen).getByRole('button', { name: 'Remove file' }))
    .toBeVisible();
  await composer(screen).fill('what is this');
  await userEvent.keyboard('{Enter}');
  await vi.waitFor(() => expect(sent('user-turns')).toHaveLength(1));
  expect(sent('user-turns')).toEqual([
    {
      text: 'what is this',
      images: [{ mimeType: 'image/png', data: 'cG5n' }],
    },
  ]);
});

test('changes the model, effort and mode of the session', async () => {
  const screen = await showChat({
    settings: {
      model: 'default',
      effort: 'high',
      mode: 'bypassPermissions',
      models: CATALOG.models,
      modes: CATALOG.modes,
    },
  });
  const model = chat(screen).getByRole('combobox', {
    name: 'Model',
    exact: true,
  });
  await expect.element(model).toHaveTextContent('Default (Opus)High');
  await model.click();
  await page.getByRole('radio', { name: 'Low' }).click();
  await page.getByRole('option', { name: /Haiku/ }).click();
  await chat(screen)
    .getByRole('combobox', { name: 'Mode', exact: true })
    .click();
  await page.getByRole('option', { name: 'Plan' }).click();
  await vi.waitFor(() =>
    expect(sent('settings')).toEqual([
      { effort: 'low' },
      { model: 'haiku' },
      { mode: 'plan' },
    ]),
  );
});

test('shows how full the context is and what the session cost', async () => {
  const screen = await showChat({
    usage: { used: 50_000, size: 200_000, cost: 1.5 },
  });
  const ring = chat(screen).getByRole('button', { name: 'Context usage' });
  await expect.element(ring).toHaveTextContent('25%');
  await ring.hover();
  await expect.element(page.getByText('50,000 / 200,000')).toBeVisible();
  await expect.element(page.getByText('$1.50')).toBeVisible();
  coreShowsConversation(A, { usage: { used: 10, size: 100, cost: null } });
  await expect.element(ring).toHaveTextContent('10%');
  await expect.element(page.getByText('Cost')).not.toBeInTheDocument();
});

test('shows the account limits above the composer', async () => {
  const screen = await showChat();
  await expect.element(composer(screen)).toBeVisible();
  await expect
    .element(chat(screen).getByRole('group', { name: 'Usage limits' }))
    .not.toBeInTheDocument();
  coreShowsRateLimits({
    windows: [
      {
        window: 'five_hour',
        utilization: 0.44,
        resetsAt: Date.now() / 1000 + 3600,
        status: 'allowed',
      },
      {
        window: 'seven_day',
        utilization: 0.95,
        resetsAt: Date.now() / 1000 + 4 * 86_400,
        status: 'allowed_warning',
      },
    ],
  });
  const limits = chat(screen).getByRole('group', { name: 'Usage limits' });
  await expect
    .element(limits.getByRole('meter', { name: '5-hour limit used' }))
    .toHaveAttribute('aria-valuenow', '44');
  await expect
    .element(limits.getByRole('meter', { name: 'Weekly limit used' }))
    .toHaveAttribute('aria-valuenow', '95');
  await expect.element(limits).toHaveTextContent(/5-hour44%resets .*Weekly95%/);
});
