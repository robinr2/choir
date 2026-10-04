import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
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
import { pane, renderApp } from '@/test/render-app';
import {
  actions,
  boxOf,
  drag,
  hintElement,
  press,
  stripElement,
  setUpStripScreen,
  measured,
} from '@/test/strip-screen';

setUpStripScreen();

function hint(): Element | null {
  return document.querySelector('[data-slot="insert-hint"]');
}

test('holds a pane back with a rubber band until it is dragged far enough', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  expect(press(first, { x: 300, y: 400 }, { altKey: true })).toBe(false);
  await expect
    .element(page.elementLocator(stripElement()))
    .toHaveAttribute('data-gesture', 'true');
  expect(stripElement().style.cursor).toBe('grabbing');
  drag('pointermove', { x: 900, y: 400 }, 2);
  drag('pointermove', { x: 400, y: 450 });
  await vi.waitFor(() => expect(boxOf(first).x).toBeGreaterThan(60));
  expect(boxOf(first).x).toBeLessThan(110);
  expect(boxOf(first).y).toBeGreaterThan(4);
  expect(boxOf(first).y).toBeLessThan(54);
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('data-focused', 'true');
  expect(hint()).toBeNull();
  drag('pointerup', { x: 400, y: 400 }, 2);
  drag('pointerup', { x: 400, y: 400 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(60));
  await expect
    .element(page.elementLocator(stripElement()))
    .toHaveAttribute('data-gesture', 'false');
  expect(actions()).toEqual([]);
});

test('drops a dragged pane where the insert hint shows', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(first, { x: 300, y: 400 }, { altKey: true });
  drag('pointermove', { x: 900, y: 400 });
  await vi.waitFor(() => expect(hint()).not.toBeNull());
  expect(boxOf(pane(screen, 'agent 2').element()).x).toBe(60);
  expect(first.getAttribute('style')).toContain('opacity: 0.75');
  expect(boxOf(first)).toMatchObject({ x: 56 + 900 - 296, y: 4, width: 594 });
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('data-focused', 'true');
  expect(boxOf(hintElement()).x).toBe(56 + 602);
  drag('pointermove', { x: 300, y: 790 });
  await vi.waitFor(() =>
    expect(boxOf(hintElement())).toMatchObject({ y: 646, height: 150 }),
  );
  drag('pointerup', { x: 300, y: 790 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'movePane', paneId: A, column: 0, tile: 1 },
    ]),
  );
  expect(hint()).toBeNull();
  expect(boxOf(pane(screen, 'agent 2').element()).x).toBe(60);
});

function movedLeft() {
  return viewOf(
    [strip('first', [column('right', [B]), column('left', [A])])],
    twoAgents().panes,
  );
}

function click(target: Element): boolean {
  return target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  );
}

test('lets the next click through when a drag ends without one', async () => {
  const screen = await renderApp();
  await measured(screen);
  const name = pane(screen, 'agent 2').getByRole('button', { name: 'agent 2' });
  press(name.element(), { x: 700, y: 20 });
  drag('pointermove', { x: 50, y: 400 });
  drag('pointerup', { x: 50, y: 400 });
  coreShowsWorkspace(movedLeft());
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(click(name.element())).toBe(true);
  await expect
    .element(screen.getByRole('textbox', { name: 'Agent name' }))
    .toBeInTheDocument();
});

test('swallows the click after a short drag sideways on the title bar', async () => {
  const screen = await renderApp();
  await measured(screen);
  const name = pane(screen, 'agent 2').getByRole('button', { name: 'agent 2' });
  press(name.element(), { x: 700, y: 20 });
  drag('pointermove', { x: 710, y: 20 });
  drag('pointerup', { x: 710, y: 20 });
  expect(click(name.element())).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(document.querySelector('input[aria-label="Agent name"]')).toBeNull();
  expect(actions()).toEqual([{ action: 'focusPane', paneId: B }]);
});

test('starts moving exactly at the threshold, also straight down', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(first, { x: 300, y: 100 }, { altKey: true });
  drag('pointermove', { x: 300, y: 356 });
  await vi.waitFor(() => expect(hint()).not.toBeNull());
  drag('pointerup', { x: 300, y: 356 });
});

test('drags a pane by its title bar without Alt and swallows the click after', async () => {
  const screen = await renderApp();
  await measured(screen);
  const name = pane(screen, 'agent 2').getByRole('button', { name: 'agent 2' });
  press(name.element(), { x: 700, y: 20 });
  drag('pointermove', { x: 50, y: 400 });
  await vi.waitFor(() => expect(hint()).not.toBeNull());
  drag('pointerup', { x: 50, y: 400 });
  drag('pointercancel', { x: 50, y: 400 });
  expect(click(name.element())).toBe(false);
  expect(click(document.body)).toBe(true);
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusPane', paneId: B },
      { action: 'movePane', paneId: B, column: 0 },
    ]),
  );
  coreShowsWorkspace(movedLeft());
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(document.querySelector('input[aria-label="Agent name"]')).toBeNull();
  expect(click(name.element())).toBe(true);
  await expect
    .element(screen.getByRole('textbox', { name: 'Agent name' }))
    .toBeInTheDocument();
});

test('renames by a plain click on the name in the title bar', async () => {
  const screen = await renderApp();
  await measured(screen);
  await pane(screen, 'agent 1')
    .getByRole('button', { name: 'agent 1' })
    .click();
  await expect
    .element(screen.getByRole('textbox', { name: 'Agent name' }))
    .toHaveFocus();
  const input = screen.getByRole('textbox', { name: 'Agent name' }).element();
  expect(press(input, { x: 100, y: 20 })).toBe(true);
});

test('scrolls the view while a dragged pane is held at an edge', async () => {
  const third = '3c9a1f7e-5b2d-4e6f-8a1c-9d0e2f3a4b5c';
  const screen = await renderApp(
    viewOf(
      [
        strip('first', [
          column('a', [A]),
          column('b', [B]),
          column('c', [third]),
        ]),
      ],
      [agent(A, 'agent 1'), agent(B, 'agent 2'), agent(third, 'agent 3')],
    ),
  );
  await measured(screen);
  press(
    pane(screen, 'agent 1').element(),
    { x: 300, y: 400 },
    { altKey: true },
  );
  drag('pointermove', { x: 1199, y: 400 });
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 3').element()).x).toBeLessThan(56 + 450),
  );
  drag('pointerup', { x: 1199, y: 400 });
  await vi.waitFor(() => expect(actions()).toHaveLength(1));
  expect(actions()[0]).toMatchObject({ action: 'movePane', paneId: A });
});

test('ignores presses outside panes and on panes of other workspaces', async () => {
  const screen = await renderApp({ ...twoAgents(), activeWorkspace: 1 });
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 1').element()).y).toBeLessThan(0),
  );
  press(
    pane(screen, 'agent 1').element(),
    { x: 300, y: 400 },
    { altKey: true },
  );
  press(stripElement(), { x: 300, y: 400 }, { altKey: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([{ action: 'focusPane', paneId: A }]);
  expect(stripElement().dataset.gesture).toBe('false');
});

function released(pointerId: number): void {
  window.dispatchEvent(
    new PointerEvent('pointermove', { clientX: 956, clientY: 400, pointerId }),
  );
}

test('ends a drag whose button was released outside the window', async () => {
  const screen = await renderApp();
  await measured(screen);
  press(
    pane(screen, 'agent 1').element(),
    { x: 300, y: 400 },
    { altKey: true },
  );
  drag('pointermove', { x: 900, y: 400 });
  released(2);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([]);
  released(1);
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'movePane', paneId: A, column: 1 }]),
  );
  expect(stripElement().dataset.gesture).toBe('false');
});
