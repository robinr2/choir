import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  A,
  B,
  column,
  coreShowsWorkspace,
  fakeCore,
  strip,
  twoAgents,
} from '@/test/fake-core';
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

test('shows which agents are working and that panes take focus by code only', async () => {
  const screen = await renderApp();
  await expect
    .element(pane(screen, 'agent 2').getByText('working'))
    .toBeVisible();
  await expect
    .element(pane(screen, 'agent 1').getByText('working'))
    .not.toBeInTheDocument();
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('tabindex', '-1');
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

test('renames a pane by clicking its name', async () => {
  const screen = await renderApp();
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
