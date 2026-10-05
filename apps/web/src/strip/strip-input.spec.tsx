import { expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { A, viewOf } from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { pane, renderApp } from '@/test/render-app';
import { actions, stripElement, setUpStripScreen } from '@/test/strip-screen';

setUpStripScreen();

const PANE = '[data-slot="pane"]';

function keydown(code: string, init: KeyboardEventInit = {}): boolean {
  return document.body.dispatchEvent(
    new KeyboardEvent('keydown', {
      code,
      altKey: true,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

test('runs the bound keys wherever the focus is', async () => {
  const screen = await renderApp();
  await expect
    .element(pane(screen, 'agent 1').getByRole('textbox'))
    .toHaveFocus();
  await userEvent.keyboard('{Alt>}j{/Alt}');
  await userEvent.keyboard('{Alt>}{Shift>}={/Shift}{/Alt}');
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusWindowOrWorkspaceDown' },
      { action: 'setWindowHeight', change: 10 },
    ]),
  );
  await expect
    .element(pane(screen, 'agent 1').getByRole('textbox'))
    .toHaveValue('');
});

test('keeps handled keys from the page', async () => {
  await renderApp();
  const heard = vi.fn<() => void>();
  document.addEventListener('keydown', heard);
  keydown('KeyJ');
  keydown('KeyE');
  document.removeEventListener('keydown', heard);
  expect(heard).toHaveBeenCalledOnce();
});

test('keeps the browser from the keys niri shares with it', async () => {
  await renderApp();
  for (const code of ['ArrowLeft', 'ArrowRight', 'KeyH', 'KeyT', 'KeyF']) {
    expect(keydown(code)).toBe(false);
  }
  expect(keydown('KeyI', { shiftKey: true })).toBe(false);
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusColumnLeft' },
      { action: 'focusColumnRight' },
      { action: 'focusColumnLeft' },
      { action: 'maximizeColumn' },
      { action: 'moveWorkspaceUp' },
    ]),
  );
  expect(requests()).toContainEqual(['/workspace/panes', 'POST', undefined]);
});

test('leaves unbound keys to the page', async () => {
  await renderApp();
  expect(keydown('KeyE')).toBe(true);
  expect(keydown('KeyJ', { altKey: false })).toBe(true);
  expect(keydown('KeyJ')).toBe(false);
});

test('closes the focused pane', async () => {
  await renderApp();
  keydown('KeyQ');
  await vi.waitFor(() =>
    expect(requests()).toContainEqual([
      `/workspace/panes/${A}`,
      'DELETE',
      undefined,
    ]),
  );
});

test('closes nothing on an empty workspace', async () => {
  await renderApp(viewOf([], []));
  expect(keydown('KeyQ')).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(requests().filter(([, method]) => method === 'DELETE')).toEqual([]);
});

test('expands the focused column into the fully visible space', async () => {
  await renderApp();
  await vi.waitFor(() =>
    expect(
      stripElement().querySelector(PANE)?.getBoundingClientRect().width,
    ).toBe(594),
  );
  keydown('KeyF', { ctrlKey: true });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      {
        action: 'expandColumnToAvailableWidth',
        visibleColumns: ['left', 'right'],
      },
    ]),
  );
});

function wheel(init: WheelEventInit): boolean {
  return stripElement().dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }),
  );
}

test('switches workspaces and columns with Alt and the wheel', async () => {
  await renderApp();
  expect(wheel({ deltaY: 120 })).toBe(true);
  expect(wheel({ deltaY: 120, altKey: true })).toBe(false);
  expect(wheel({ deltaX: 120, altKey: true })).toBe(false);
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusWorkspaceDown' },
      { action: 'focusColumnRight' },
    ]),
  );
});

function menu(altKey: boolean): boolean {
  return stripElement().dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, altKey }),
  );
}

test('keeps the context menu away only while Alt is held', async () => {
  await renderApp();
  expect(menu(true)).toBe(false);
  expect(menu(false)).toBe(true);
});
