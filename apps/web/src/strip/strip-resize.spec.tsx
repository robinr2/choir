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

const RIGHT = { button: 2, altKey: true };

test('widens a column from its right edge', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  expect(press(first, { x: 500, y: 400 }, RIGHT)).toBe(false);
  expect(stripElement().style.cursor).toBe('');
  await vi.waitFor(() => expect(stripElement().style.cursor).toBe('e-resize'));
  drag('pointermove', { x: 600, y: 400 });
  await vi.waitFor(() => expect(boxOf(first).width).toBe(694));
  drag('pointerup', { x: 600, y: 400 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'resizePane', paneId: A, width: 698 / 1196 },
    ]),
  );
  expect(boxOf(first).width).toBe(694);
});

test('keeps the right edge in place while resizing from the left', async () => {
  const focused = strip('first', [column('left', [A]), column('right', [B])], {
    activeColumn: 1,
  });
  const screen = await renderApp(viewOf([focused], twoAgents().panes));
  const second = pane(screen, 'agent 2').element();
  await vi.waitFor(() => expect(boxOf(second).x).toBe(60));
  press(second, { x: 50, y: 400 }, RIGHT);
  drag('pointermove', { x: -50, y: 400 });
  await vi.waitFor(() => expect(boxOf(second).width).toBe(694));
  expect(boxOf(second).right).toBe(56 + 598);
  drag('pointerup', { x: -50, y: 400 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'resizePane', paneId: B, width: 698 / 1196 },
    ]),
  );
  expect(boxOf(second).x).toBe(60);
});

test('sets the height of a pane from its bottom or lower top edge', async () => {
  const screen = await renderApp(
    viewOf([strip('first', [column('only', [A, B])])], twoAgents().panes),
  );
  const second = pane(screen, 'agent 2').element();
  await vi.waitFor(() => expect(boxOf(second).y).toBe(402));
  press(second, { x: 300, y: 410 }, RIGHT);
  drag('pointermove', { x: 300, y: 310 });
  await vi.waitFor(() => expect(boxOf(second).height).toBe(494));
  expect(boxOf(pane(screen, 'agent 1').element()).height).toBe(294);
  drag('pointerup', { x: 300, y: 310 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'focusPane', paneId: B },
      { action: 'resizePane', paneId: B, height: 498 / 796 },
    ]),
  );
});

test('makes a lone pane shorter from its bottom edge', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(first, { x: 300, y: 700 }, RIGHT);
  drag('pointermove', { x: 300, y: 600 });
  await vi.waitFor(() => expect(boxOf(first).height).toBe(692));
  drag('pointerup', { x: 300, y: 600 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'resizePane', paneId: A, height: 696 / 796 },
    ]),
  );
});

test('makes a pane at most as tall as the workspace', async () => {
  const screen = await renderApp();
  await measured(screen);
  press(pane(screen, 'agent 1').element(), { x: 300, y: 700 }, RIGHT);
  drag('pointermove', { x: 300, y: 1300 });
  drag('pointerup', { x: 300, y: 1300 });
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'resizePane', paneId: A, height: 1 }]),
  );
});

test('does not resize from the middle or the top edge of the top pane', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(first, { x: 300, y: 400 }, RIGHT);
  expect(stripElement().dataset.gesture).toBe('false');
  press(first, { x: 300, y: 100 }, RIGHT);
  press(first, { x: 600, y: 100 }, { button: 3, altKey: true });
  drag('pointermove', { x: 300, y: 300 });
  drag('pointerup', { x: 300, y: 300 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(stripElement().dataset.gesture).toBe('false');
  expect(actions()).toEqual([]);
});

test('does not resize on a right drag without Alt', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(first, { x: 500, y: 400 }, { button: 2 });
  drag('pointermove', { x: 600, y: 400 });
  drag('pointerup', { x: 600, y: 400 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(stripElement().dataset.gesture).toBe('false');
  expect(boxOf(first).width).toBe(594);
  expect(actions()).toEqual([]);
});

test('ends a resize without moving as nothing', async () => {
  const screen = await renderApp();
  await measured(screen);
  press(pane(screen, 'agent 1').element(), { x: 500, y: 400 }, RIGHT);
  drag('pointerup', { x: 500, y: 400 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([]);
});

test('toggles full width or resets the height on a double right click', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  press(first, { x: 500, y: 700 }, RIGHT);
  drag('pointerup', { x: 500, y: 700 });
  press(first, { x: 500, y: 700 }, RIGHT);
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'maximizeColumn' },
      { action: 'resetWindowHeight' },
    ]),
  );
  expect(stripElement().dataset.gesture).toBe('false');
});

test('toggles only what the double clicked edge sizes', async () => {
  const screen = await renderApp();
  await measured(screen);
  const first = pane(screen, 'agent 1').element();
  for (const at of [
    { x: 500, y: 400 },
    { x: 500, y: 400 },
    { x: 300, y: 700 },
    { x: 300, y: 700 },
  ]) {
    press(first, at, RIGHT);
    drag('pointerup', at);
  }
  await vi.waitFor(() =>
    expect(actions()).toEqual([
      { action: 'maximizeColumn' },
      { action: 'resetWindowHeight' },
    ]),
  );
});

test('does not resize a pane of another workspace', async () => {
  const screen = await renderApp({ ...twoAgents(), activeWorkspace: 1 });
  const first = pane(screen, 'agent 1').element();
  await vi.waitFor(() => expect(boxOf(first).y).toBeLessThan(0));
  press(first, { x: 500, y: 400 }, RIGHT);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(stripElement().dataset.gesture).toBe('false');
});

test('does not resize from the middle of a lower pane', async () => {
  const screen = await renderApp(
    viewOf([strip('first', [column('only', [A, B])])], twoAgents().panes),
  );
  const second = pane(screen, 'agent 2').element();
  await vi.waitFor(() => expect(boxOf(second).y).toBe(402));
  press(second, { x: 300, y: 600 }, RIGHT);
  drag('pointermove', { x: 300, y: 500 });
  drag('pointerup', { x: 300, y: 500 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toEqual([{ action: 'focusPane', paneId: B }]);
});

test('measures the pointer from the top of the strip', async () => {
  const screen = await renderApp();
  await measured(screen);
  stripElement().style.marginTop = '20px';
  press(pane(screen, 'agent 1').element(), { x: 300, y: 550 }, RIGHT);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(stripElement().dataset.gesture).toBe('false');
});
