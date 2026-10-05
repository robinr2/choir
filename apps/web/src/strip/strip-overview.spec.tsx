import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  A,
  agent,
  B,
  column,
  coreShowsWorkspace,
  strip,
  twoAgents,
  viewOf,
} from '@/test/fake-core';
import { pane, renderApp, type Screen } from '@/test/render-app';
import {
  actions,
  boxOf,
  drag,
  hintElement,
  measured,
  press,
  setUpStripScreen,
  stripElement,
} from '@/test/strip-screen';

setUpStripScreen();

const STACKED = viewOf(
  [
    strip('first', [column('left', [A])]),
    strip('second', [column('right', [B])]),
  ],
  [agent(A, 'agent 1'), agent(B, 'agent 2')],
);

function key(code: string, init: KeyboardEventInit = {}): boolean {
  return document.body.dispatchEvent(
    new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

function wheel(init: WheelEventInit): boolean {
  return window.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }),
  );
}

function overview() {
  return page.elementLocator(stripElement());
}

function workspace(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-workspace-id="${id}"]`,
  );
  if (!found) throw new Error(`No workspace ${id}`);
  return found;
}

async function opened(screen: Screen): Promise<Element> {
  await measured(screen);
  key('KeyO', { altKey: true });
  await expect.element(overview()).toHaveAttribute('data-overview', 'true');
  const first = pane(screen, 'agent 1').element();
  await vi.waitFor(() =>
    expect(boxOf(first)).toMatchObject({ x: 358, y: 202, width: 297 }),
  );
  return first;
}

async function openedOnSecond(screen: Screen): Promise<Element> {
  const second = pane(screen, 'agent 2').element();
  await vi.waitFor(() => expect(boxOf(second).y).toBe(884));
  key('KeyO', { altKey: true });
  await vi.waitFor(() => expect(boxOf(second).y).toBe(642));
  return second;
}

test('zooms out to every workspace at half size and back in', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  key('KeyO', { altKey: true });
  await vi.waitFor(() => {
    const { width } = boxOf(first);
    expect(width).toBeLessThan(594);
    expect(width).toBeGreaterThan(297);
  });
  await vi.waitFor(() =>
    expect(boxOf(first)).toMatchObject({ x: 358, y: 202, width: 297 }),
  );
  expect(boxOf(workspace('first'))).toMatchObject({
    x: 356,
    y: 200,
    width: 600,
    height: 400,
  });
  expect(boxOf(workspace('last')).y).toBe(640);
  expect(first.dataset.focused).toBe('true');
  expect(key('KeyO', { altKey: true, repeat: true })).toBe(true);
  key('Escape');
  await expect.element(overview()).toHaveAttribute('data-overview', 'false');
  await vi.waitFor(() =>
    expect(boxOf(first)).toMatchObject({ x: 60, y: 4, width: 594 }),
  );
  expect(actions()).toEqual([]);
});

test('keeps the keys from the panes while it is open', async () => {
  const screen = await renderApp();
  const textbox = pane(screen, 'agent 1').getByRole('textbox');
  await expect.element(textbox).toHaveFocus();
  await opened(screen);
  await expect.element(textbox).not.toHaveFocus();
  expect(document.activeElement).toBe(stripElement());
  await userEvent.keyboard('hello');
  for (const code of ['ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowLeft']) {
    expect(key(code)).toBe(false);
  }
  key('KeyL', { altKey: true });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusColumnRight' },
      { action: 'focusWindowOrWorkspaceDown' },
      { action: 'focusWindowOrWorkspaceUp' },
      { action: 'focusColumnLeft' },
      { action: 'focusColumnRight' },
    ]),
  );
  key('Enter');
  await expect.element(overview()).toHaveAttribute('data-overview', 'false');
  await expect.element(textbox).toHaveFocus();
  await expect.element(textbox).toHaveValue('');
});

test('closes on the workspace of a clicked pane', async () => {
  const screen = await renderApp(STACKED);
  const second = await openedOnSecond(screen);
  press(second, { x: 400, y: 700 });
  drag('pointerup', { x: 400, y: 700 });
  await expect.element(overview()).toHaveAttribute('data-overview', 'false');
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'focusPane', paneId: B }]),
  );
  coreShowsWorkspace({ ...STACKED, activeWorkspace: 1 });
  await vi.waitFor(() => expect(boxOf(second)).toMatchObject({ x: 60, y: 4 }));
});

test('closes on a clicked workspace', async () => {
  const screen = await renderApp();
  await opened(screen);
  const last = workspace('last');
  press(last, { x: 600, y: 700 });
  await expect.element(overview()).toHaveAttribute('data-overview', 'false');
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusWorkspace', workspaceId: 'last' },
    ]),
  );
});

test('drags a pane into a new workspace between two others', async () => {
  const screen = await renderApp();
  const first = await opened(screen);
  press(first, { x: 400, y: 300 });
  drag('pointermove', { x: 400, y: 700 });
  drag('pointermove', { x: 400, y: 620 });
  await vi.waitFor(() =>
    expect(boxOf(hintElement())).toMatchObject({
      x: 431,
      y: 604,
      width: 450,
      height: 32,
    }),
  );
  expect(stripElement().style.cursor).toBe('grabbing');
  drag('pointerup', { x: 400, y: 620 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'movePaneToNewWorkspace', paneId: A, index: 1 },
    ]),
  );
  await expect.element(overview()).toHaveAttribute('data-overview', 'true');
  coreShowsWorkspace({
    ...twoAgents(),
    workspaces: [
      strip('first', [column('right', [B])]),
      strip('fresh', [column('left', [A])]),
      strip('last', []),
    ],
  });
  await vi.waitFor(() =>
    expect(boxOf(first)).toMatchObject({ x: 358, y: 642 }),
  );
  expect(boxOf(workspace('fresh')).y).toBe(640);
});

test('holds a pane back until it is dragged far enough', async () => {
  const screen = await renderApp();
  const first = await opened(screen);
  press(first, { x: 400, y: 300 });
  drag('pointermove', { x: 404, y: 300 });
  drag('pointermove', { x: 500, y: 300 });
  await vi.waitFor(() => expect(boxOf(first).x).toBeGreaterThan(358));
  expect(boxOf(first).x).toBeLessThan(358 + 100);
  expect(document.querySelector('[data-slot="insert-hint"]')).toBeNull();
  drag('pointerup', { x: 500, y: 300 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(358));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([]);
  await expect.element(overview()).toHaveAttribute('data-overview', 'true');
});

test('scrolls the workspaces while a dragged pane is held at an edge', async () => {
  const screen = await renderApp(STACKED);
  const second = await openedOnSecond(screen);
  press(pane(screen, 'agent 1').element(), { x: 500, y: 300 });
  drag('pointermove', { x: 500, y: 795 });
  await vi.waitFor(() => expect(boxOf(second).y).toBeLessThan(400));
  drag('pointerup', { x: 500, y: 795 });
  await vi.waitFor(() => expect(actions()).toHaveLength(2));
  expect(actions()[1]).toEqual({
    action: 'focusWorkspace',
    workspaceId: 'second',
  });
});

test('ignores other buttons and presses beside the workspaces', async () => {
  const screen = await renderApp();
  const first = await opened(screen);
  press(first, { x: 400, y: 300 }, { button: 1 });
  press(stripElement(), { x: 10, y: 10 });
  const stranger = document.createElement('div');
  stranger.dataset.paneId = 'nowhere';
  stripElement().append(stranger);
  press(stranger, { x: 10, y: 10 });
  drag('pointerup', { x: 10, y: 10 });
  stranger.remove();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([]);
  await expect.element(overview()).toHaveAttribute('data-overview', 'true');
});

test('drags a pane into another workspace', async () => {
  const screen = await renderApp();
  const first = await opened(screen);
  press(first, { x: 400, y: 300 });
  drag('pointermove', { x: 400, y: 700 });
  await vi.waitFor(() =>
    expect(boxOf(hintElement())).toMatchObject({ y: 642, height: 396 }),
  );
  drag('pointerup', { x: 400, y: 700 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'movePane', paneId: A, column: 0, workspaceId: 'last' },
    ]),
  );
  coreShowsWorkspace({
    ...twoAgents(),
    workspaces: [
      strip('first', [column('right', [B])]),
      strip('last', [column('left', [A])]),
      strip('bottom', []),
    ],
  });
  await vi.waitFor(() => expect(boxOf(first).y).toBe(642));
});

test('switches workspaces and columns with the plain wheel', async () => {
  const screen = await renderApp();
  await opened(screen);
  expect(wheel({ deltaY: 120, clientX: 600, clientY: 400 })).toBe(false);
  expect(wheel({ deltaX: 120, clientX: 600, clientY: 400 })).toBe(false);
  expect(wheel({ deltaX: 120, clientX: 600, clientY: 620 })).toBe(false);
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusWorkspaceDown' },
      { action: 'focusColumnRight', workspaceId: 'first' },
    ]),
  );
});

test('places the hint without the dragged pane from the first frame on', async () => {
  const screen = await renderApp();
  const first = await opened(screen);
  press(first, { x: 400, y: 300 });
  drag('pointermove', { x: 750, y: 300 });
  const early = await vi.waitFor(() => boxOf(hintElement()));
  drag('pointermove', { x: 750, y: 300 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(boxOf(hintElement())).toEqual(early);
  drag('pointerup', { x: 750, y: 300 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'movePane', paneId: A, column: 1, workspaceId: 'first' },
    ]),
  );
});

const C = '5c3d2e1f-0a9b-4c8d-8e7f-6a5b4c3d2e1f';

const WIDE = viewOf(
  [
    strip('first', [column('left', [A])]),
    strip('second', [column('right', [B]), column('third', [C])]),
  ],
  [agent(A, 'agent 1'), agent(B, 'agent 2'), agent(C, 'agent 3')],
);

test('pans the view of the focused workspace with a right drag', async () => {
  const screen = await renderApp();
  const first = await opened(screen);
  expect(press(first, { x: 400, y: 300 }, { button: 2 })).toBe(false);
  expect(
    first.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    ),
  ).toBe(false);
  await vi.waitFor(() =>
    expect(stripElement().style.cursor).toBe('all-scroll'),
  );
  drag('pointermove', { x: 350, y: 300 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(308));
  drag('pointermove', { x: 340, y: 340 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(298));
  expect(boxOf(first).y).toBe(202);
  drag('pointerup', { x: 340, y: 340 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'focusColumn', columnId: 'right' }]),
  );
  await expect.element(overview()).toHaveAttribute('data-overview', 'true');
});

test('pans another workspace and focuses its column there', async () => {
  const screen = await renderApp(WIDE);
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 3').element()).x).toBe(658),
  );
  key('KeyO', { altKey: true });
  const second = pane(screen, 'agent 2').element();
  await vi.waitFor(() => expect(boxOf(second).y).toBe(642));
  press(second, { x: 400, y: 700 }, { button: 2 });
  drag('pointermove', { x: 350, y: 700 });
  drag('pointermove', { x: 340, y: 700 });
  await vi.waitFor(() => expect(boxOf(second).x).toBe(298));
  drag('pointerup', { x: 340, y: 700 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusColumn', columnId: 'third', workspaceId: 'second' },
    ]),
  );
});

test('switches workspaces with an Alt middle drag', async () => {
  const screen = await renderApp();
  await opened(screen);
  press(stripElement(), { x: 600, y: 400 }, { button: 1, altKey: true });
  drag('pointermove', { x: 600, y: 390 });
  drag('pointermove', { x: 600, y: 100 });
  await vi.waitFor(() => expect(boxOf(workspace('last')).y).toBeLessThan(500));
  drag('pointerup', { x: 600, y: 100 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusWorkspace', workspaceId: 'last' },
    ]),
  );
});

test('ignores pans beside the workspaces', async () => {
  const screen = await renderApp();
  await opened(screen);
  expect(press(stripElement(), { x: 600, y: 620 }, { button: 2 })).toBe(true);
  drag('pointerup', { x: 600, y: 620 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(stripElement().dataset.gesture).toBe('false');
});

test('scrolls the workspace under a pane held at a side edge', async () => {
  const screen = await renderApp(STACKED);
  const second = await openedOnSecond(screen);
  press(pane(screen, 'agent 1').element(), { x: 400, y: 300 });
  drag('pointermove', { x: 1195, y: 700 });
  await vi.waitFor(() => expect(boxOf(second).x).toBeLessThan(200));
  drag('pointerup', { x: 1195, y: 700 });
  await vi.waitFor(() => expect(actions()).toHaveLength(1));
  expect(actions()[0]).toMatchObject({
    action: 'movePane',
    paneId: A,
    workspaceId: 'second',
  });
});

test('scrolls the workspace a pane is dragged out of at a side edge', async () => {
  const screen = await renderApp();
  const first = await opened(screen);
  const second = pane(screen, 'agent 2').element();
  press(first, { x: 400, y: 300 });
  drag('pointermove', { x: 1195, y: 300 });
  await vi.waitFor(() => expect(boxOf(second).x).toBeLessThan(250));
  drag('pointerup', { x: 1195, y: 300 });
  await vi.waitFor(() => expect(actions()).toHaveLength(1));
  expect(actions()[0]).toMatchObject({
    action: 'movePane',
    paneId: A,
    workspaceId: 'first',
  });
});
