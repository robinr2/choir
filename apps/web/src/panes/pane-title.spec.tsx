import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  A,
  B,
  column,
  coreShowsConversation,
  coreShowsWorkspace,
  fakeCore,
  strip,
  twoAgents,
} from '@/test/fake-core';
import { OTHER_SESSION, SESSION } from '@/test/fake-agents';
import { requests } from '@/test/fake-event-source';
import { pane, renderApp } from '@/test/render-app';

function requestsWith(method: string) {
  return requests().filter(([, used]) => used === method);
}

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('shows the status of each agent and that panes take focus by code only', async () => {
  const screen = await renderApp();
  coreShowsConversation(B, {
    status: { state: 'working', since: Date.now() - 5000 },
  });
  coreShowsConversation(A, { status: { state: 'failed', since: 0 } });
  const working = pane(screen, 'agent 2').getByText('Working', { exact: true });
  await expect.element(working).toBeVisible();
  await expect.element(pane(screen, 'agent 2').getByText('0:05')).toBeVisible();
  await expect.element(pane(screen, 'agent 2').getByText('0:06')).toBeVisible();
  await expect
    .element(pane(screen, 'agent 1').getByText('Failed', { exact: true }))
    .toBeVisible();
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('tabindex', '-1');
});

test('ticks once an agent starts working since the same moment', async () => {
  const clearInterval = vi.spyOn(window, 'clearInterval');
  const screen = await renderApp();
  const since = Date.now() - 5000;
  coreShowsConversation(A, { status: { state: 'idle', since } });
  await expect
    .element(pane(screen, 'agent 1').getByText('Done', { exact: true }))
    .toBeVisible();
  coreShowsConversation(A, { status: { state: 'working', since } });
  await expect.element(pane(screen, 'agent 1').getByText('0:06')).toBeVisible();
  expect(clearInterval).not.toHaveBeenCalled();
  coreShowsConversation(A, { status: { state: 'idle', since } });
  await expect
    .element(pane(screen, 'agent 1').getByText('Done', { exact: true }))
    .toBeVisible();
  expect(clearInterval).toHaveBeenCalledOnce();
});

test('tells when an agent waits, is done or starts', async () => {
  const screen = await renderApp();
  await expect
    .element(pane(screen, 'agent 1').getByText('Starting'))
    .toBeVisible();
  coreShowsConversation(A, { status: { state: 'waiting', since: Date.now() } });
  await expect
    .element(pane(screen, 'agent 1').getByText('Waiting for you'))
    .toBeVisible();
  await expect.element(pane(screen, 'agent 1').getByText('0:00')).toBeVisible();
  coreShowsConversation(A, { status: { state: 'idle', since: Date.now() } });
  await expect
    .element(pane(screen, 'agent 1').getByText('Done', { exact: true }))
    .toBeVisible();
  await expect
    .element(pane(screen, 'agent 1').getByText('0:00'))
    .not.toBeInTheDocument();
});

test('shows the session of an agent and copies its id', async () => {
  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue(undefined);
  await page.viewport(1256, 800);
  const screen = await renderApp();
  const title = pane(screen, 'agent 1').getByText('Fix the login bug');
  coreShowsConversation(A, {
    session: { id: SESSION, title: 'Fix the login bug', cwd: '/home/sam' },
  });
  await expect.element(title).toHaveClass('truncate');
  await expect.element(title).toHaveAttribute('title', 'Fix the login bug');
  const shortId = pane(screen, 'agent 1').getByText('a1b2c3d4', {
    exact: true,
  });
  await expect.element(shortId).toHaveAttribute('title', SESSION);
  await expect.element(shortId).toBeVisible();
  await page.viewport(600, 800);
  await expect.element(shortId).not.toBeVisible();
  await expect.element(title).toBeVisible();
  await page.viewport(1256, 800);
  await pane(screen, 'agent 1')
    .getByRole('button', { name: 'Copy session ID' })
    .click();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(SESSION);
  await expect
    .element(pane(screen, 'agent 1').getByRole('button', { name: 'Copied' }))
    .toBeVisible();
  coreShowsConversation(A, {
    session: { id: OTHER_SESSION, title: null, cwd: '/home/sam' },
  });
  await pane(screen, 'agent 1')
    .getByRole('button', { name: /Copied|Copy session ID/ })
    .click();
  expect(writeText).toHaveBeenLastCalledWith(OTHER_SESSION);
  await expect
    .element(pane(screen, 'agent 1').getByText('Fix the login bug'))
    .not.toBeInTheDocument();
});

test('closes a pane from its title bar', async () => {
  const screen = await renderApp();
  await pane(screen, 'agent 2').getByRole('button', { name: 'Close' }).click();
  await vi.waitFor(() =>
    expect(requestsWith('DELETE')).toEqual([
      [`/workspace/panes/${B}`, 'DELETE', undefined],
    ]),
  );
});

const EDITOR = 'input[aria-label="Agent name"]';

test('renames a pane by clicking its name', async () => {
  let edited = false;
  const watch = new MutationObserver((records) => {
    const removed = records.flatMap(({ removedNodes }) => [...removedNodes]);
    edited ||= removed.some(
      (node) => node instanceof Element && node.matches(EDITOR),
    );
  });
  watch.observe(document.body, { subtree: true, childList: true });
  const screen = await renderApp();
  await expect.element(pane(screen, 'agent 1')).toBeInTheDocument();
  watch.disconnect();
  expect(edited).toBe(false);
  await screen.getByRole('button', { name: 'agent 1' }).click();
  const input = screen.getByRole('textbox', { name: 'Agent name' });
  await expect.element(input).toHaveFocus();
  await userEvent.keyboard('x');
  await settled();
  await expect.element(input).toBeInTheDocument();
  await input.fill('  planner ');
  await userEvent.keyboard('{Enter}');
  await expect.element(input).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'agent 2' }).click();
  await input.fill('ignored');
  await userEvent.keyboard('{Escape}');
  await expect.element(input).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'agent 2' }).click();
  await input.fill(' ');
  await userEvent.keyboard('{Tab}');
  await expect.element(input).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'agent 1' }).click();
  await userEvent.keyboard('{Enter}');
  expect(requestsWith('PATCH')).toEqual([
    [`/workspace/panes/${A}`, 'PATCH', { name: 'planner' }],
  ]);
});

test('keeps the keyboard where it is inside the pane that gets focus', async () => {
  const screen = await renderApp();
  await screen.getByRole('button', { name: 'agent 2' }).click();
  const input = screen.getByRole('textbox', { name: 'Agent name' });
  await expect.element(input).toHaveFocus();
  coreShowsWorkspace({
    ...twoAgents(),
    workspaces: [
      strip('first', [column('left', [A]), column('right', [B])], {
        activeColumn: 1,
      }),
    ],
  });
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-focused', 'true');
  await expect.element(input).toHaveFocus();
});

test('shows nothing for a pane it does not know', async () => {
  const screen = await renderApp({ ...twoAgents(), panes: [] });
  await settled();
  await expect.element(pane(screen, 'agent 1')).not.toBeInTheDocument();
});
