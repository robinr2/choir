import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  A,
  B,
  CANVAS_URL,
  column,
  fakeCore,
  strip,
  viewOf,
} from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { pane, renderApp } from '@/test/render-app';
import type { WorkspaceView } from '@/workspace/core-workspace';

const C = '3c9a1f7e-5b2d-4e6f-8a1c-9d0e2f3a4b5c';

function panes(
  ...kinds: ('empty' | 'excalidraw')[]
): Omit<WorkspaceView, 'loaded'> {
  const ids = [B, C].slice(0, kinds.length);
  return viewOf(
    [strip('first', [column('only', [A, ...ids])])],
    [
      { id: A, kind: 'agent', name: 'agent 1', working: false },
      ...kinds.map((kind, index) => ({ id: ids[index], kind })),
    ],
  );
}

function contentRequests() {
  return requests().filter(([url]) => url.endsWith('/content'));
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('offers to open an agent or Excalidraw in an empty pane', async () => {
  const screen = await renderApp(panes('empty'));
  const empty = pane(screen, 'New pane');
  await expect.element(empty.getByText('New pane')).toBeVisible();
  await expect
    .element(empty.getByRole('button', { name: 'Rename' }))
    .not.toBeInTheDocument();
  await empty.getByRole('button', { name: 'Agent' }).click();
  await empty.getByRole('button', { name: 'Excalidraw' }).click();
  await vi.waitFor(() =>
    expect(contentRequests()).toEqual([
      [`/workspace/panes/${B}/content`, 'PUT', { kind: 'agent' }],
      [`/workspace/panes/${B}/content`, 'PUT', { kind: 'excalidraw' }],
    ]),
  );
  expect(empty.element().hasAttribute('data-voice')).toBe(false);
});

test('greys out Excalidraw while another pane shows it', async () => {
  const screen = await renderApp(panes('excalidraw', 'empty'));
  const empty = pane(screen, 'New pane');
  const excalidraw = empty.getByRole('button', { name: 'Excalidraw' });
  await expect.element(excalidraw).toHaveAttribute('aria-disabled', 'true');
  await expect.element(excalidraw).toHaveClass('data-disabled:opacity-50');
  await excalidraw.hover();
  await expect
    .element(screen.getByText('Excalidraw is already open in another pane'))
    .toBeVisible();
  await excalidraw.click({ force: true });
  await empty.getByRole('button', { name: 'Agent' }).click();
  await vi.waitFor(() =>
    expect(contentRequests()).toEqual([
      [`/workspace/panes/${C}/content`, 'PUT', { kind: 'agent' }],
    ]),
  );
});

test('shows the canvas of the Excalidraw server in its pane', async () => {
  const screen = await renderApp(panes('excalidraw'));
  const canvas = pane(screen, 'Excalidraw');
  const frame = canvas.getByTitle('Excalidraw canvas');
  await expect.element(frame).toHaveAttribute('src', CANVAS_URL);
  await expect
    .element(frame)
    .toHaveAttribute('allow', 'clipboard-read; clipboard-write');
  await expect.element(frame).toHaveClass('size-full');
  await expect.element(canvas.getByText('Excalidraw')).toBeVisible();
  await expect
    .element(canvas.getByRole('button', { name: 'Close' }))
    .toBeVisible();
  expect(requests().filter(([url]) => url === '/canvas')).toEqual([
    ['/canvas', 'GET', undefined],
  ]);
});
