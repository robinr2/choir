import { expect, test, vi } from 'vitest';
import { A, B, column, strip, twoAgents, viewOf } from '@/test/fake-core';
import { pane, renderApp } from '@/test/render-app';
import {
  actions,
  boxOf,
  drag,
  press,
  stripElement,
  setUpStripScreen,
  measured,
} from '@/test/strip-screen';

setUpStripScreen();

const MIDDLE = { button: 1, altKey: true };

test('moves the view sideways and snaps it to the columns', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  expect(press(stripElement(), { x: 600, y: 400 }, MIDDLE)).toBe(false);
  await vi.waitFor(() => expect(stripElement().dataset.gesture).toBe('true'));
  expect(stripElement().style.cursor).toBe('all-scroll');
  drag('pointermove', { x: 594, y: 402 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(boxOf(first).x).toBe(60);
  drag('pointermove', { x: 500, y: 400 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(-40));
  drag('pointermove', { x: 480, y: 500 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(-60));
  expect(boxOf(first).y).toBe(4);
  drag('pointerup', { x: 480, y: 500 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'focusColumn', columnId: 'right' }]),
  );
  expect(boxOf(first).x).toBe(60);
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-focused', 'true');
});

test('keeps the focused column when the view snaps to it', async () => {
  const focused = strip('first', [column('left', [A]), column('right', [B])], {
    activeColumn: 1,
  });
  const screen = await renderApp(viewOf([focused], twoAgents().panes));
  const second = pane(screen, 'agent 2').element();
  await vi.waitFor(() => expect(boxOf(second).x).toBe(60));
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 650, y: 400 });
  drag('pointermove', { x: 700, y: 400 });
  await vi.waitFor(() => expect(boxOf(second).x).toBe(160));
  await new Promise((resolve) => setTimeout(resolve, 200));
  drag('pointerup', { x: 700, y: 400 });
  await vi.waitFor(() => expect(boxOf(second).x).toBe(658));
  expect(actions()).toEqual([]);
});

test('switches workspaces by dragging the view up or down', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 600, y: -100 });
  await vi.waitFor(() => expect(boxOf(first).y).toBe(-496));
  drag('pointerup', { x: 600, y: -100 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusWorkspace', workspaceId: 'last' },
    ]),
  );
  expect(boxOf(first).y).toBe(4 - 880);
});

test('snaps back to the workspace after a short slow drag', async () => {
  const screen = await renderApp({ ...twoAgents(), activeWorkspace: 1 });
  const first = pane(screen, 'agent 1').element();
  await vi.waitFor(() => expect(boxOf(first).y).toBe(4 - 880));
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 600, y: 500 });
  await vi.waitFor(() => expect(boxOf(first).y).toBe(4 - 780));
  drag('pointermove', { x: 600, y: 2000 });
  await vi.waitFor(() => expect(boxOf(first).y).toBeGreaterThan(4));
  expect(boxOf(first).y).toBeLessThan(60);
  drag('pointermove', { x: 600, y: 420 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  drag('pointerup', { x: 600, y: 420 });
  await vi.waitFor(() => expect(boxOf(first).y).toBe(4 - 880));
  expect(actions()).toEqual([]);
});

test('does nothing for a middle click or a drag over an empty workspace', async () => {
  await renderApp(viewOf([], []));
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointerup', { x: 600, y: 400 });
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 300, y: 400 });
  drag('pointerup', { x: 300, y: 400 });
  press(stripElement(), { x: 600, y: 400 }, { button: 1 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([]);
  expect(stripElement().dataset.gesture).toBe('false');
});

test('does nothing before core shows any workspace', async () => {
  await renderApp({
    workspaces: [],
    activeWorkspace: 0,
    panes: [],
    voiceAgentId: null,
  });
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 300, y: 400 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(stripElement().dataset.gesture).toBe('false');
});

test('ignores presses on what is not an element', async () => {
  const screen = await renderApp();
  await measured(screen);
  const text = document.createTextNode('');
  pane(screen, 'agent 2').element().append(text);
  text.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, altKey: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([]);
  expect(stripElement().dataset.gesture).toBe('false');
});

test('recognizes a drag of exactly 8 pixels and takes a diagonal as vertical', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 608, y: 400 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(68));
  drag('pointermove', { x: 618, y: 400 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(78));
  drag('pointerup', { x: 618, y: 400 });
  await vi.waitFor(() => expect(boxOf(first).x).toBe(60));
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 606, y: 406 });
  drag('pointermove', { x: 606, y: 416 });
  await vi.waitFor(() => expect(boxOf(first).y).toBeGreaterThan(4));
  expect(boxOf(first).x).toBe(60);
  drag('pointerup', { x: 606, y: 416 });
});

test('stops at the last workspace with a rubber band', async () => {
  const screen = await renderApp({ ...twoAgents(), activeWorkspace: 1 });
  const first = pane(screen, 'agent 1').element();
  await vi.waitFor(() => expect(boxOf(first).y).toBe(4 - 880));
  press(stripElement(), { x: 600, y: 400 }, MIDDLE);
  drag('pointermove', { x: 600, y: -2000 });
  await vi.waitFor(() => expect(boxOf(first).y).toBeLessThan(4 - 880));
  expect(boxOf(first).y).toBeGreaterThan(4 - 940);
  drag('pointerup', { x: 600, y: -2000 });
  await vi.waitFor(() => expect(boxOf(first).y).toBe(4 - 880));
  expect(actions()).toEqual([]);
});
