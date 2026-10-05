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
import { requests } from '@/test/fake-event-source';
import { pane, renderApp } from '@/test/render-app';
import { ViewStore } from './view-store';
import {
  actions,
  boxOf,
  measured,
  stripElement,
  setUpStripScreen,
} from '@/test/strip-screen';

setUpStripScreen();

function focusedSecond() {
  return {
    ...twoAgents(),
    workspaces: [
      strip('first', [column('left', [A]), column('right', [B])], {
        activeColumn: 1,
      }),
      strip('last', []),
    ],
  };
}

test('lays the columns out side by side from their proportions', async () => {
  const screen = await renderApp();
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 2').element()).x).toBe(658),
  );
  const left = boxOf(pane(screen, 'agent 1').element());
  const right = boxOf(pane(screen, 'agent 2').element());
  expect([left.x, left.y, left.width, left.height]).toEqual([60, 4, 594, 792]);
  expect([right.x, right.width]).toEqual([658, 594]);
  expect(boxOf(stripElement()).width).toBe(1200);
});

test('marks the focused pane', async () => {
  const screen = await renderApp();
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('data-focused', 'true');
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-focused', 'false');
  const frame = pane(screen, 'agent 1').element().firstElementChild;
  expect(frame?.classList.contains('ring-3')).toBe(true);
  coreShowsWorkspace(focusedSecond());
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-focused', 'true');
  coreShowsWorkspace(
    viewOf([strip('first', [column('both', [A, B])])], twoAgents().panes),
  );
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('data-focused', 'true');
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-focused', 'false');
  expect(pane(screen, 'agent 2').element().style.opacity).toBe('');
});

test('shows only the empty background when nothing is open', async () => {
  await renderApp(viewOf([], []));
  await expect.element(page.elementLocator(stripElement())).toBeVisible();
  expect(stripElement().querySelectorAll('[data-slot="pane"]')).toHaveLength(0);
});

test('places the panes of other workspaces outside the view', async () => {
  const screen = await renderApp(
    viewOf(
      [
        strip('first', [column('left', [A])]),
        strip('second', [column('down', [B])]),
      ],
      [agent(A, 'agent 1'), agent(B, 'agent 2')],
      { activeWorkspace: 1 },
    ),
  );
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 1').element()).y).toBe(4 - 880),
  );
  expect(boxOf(pane(screen, 'agent 2').element()).y).toBe(4);
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('data-focused', 'false');
});

test('scrolls the view to keep the focused column fully visible', async () => {
  const third = '3c9a1f7e-5b2d-4e6f-8a1c-9d0e2f3a4b5c';
  const panes = [
    agent(A, 'agent 1'),
    agent(B, 'agent 2'),
    agent(third, 'agent 3'),
  ];
  const columns = [column('a', [A]), column('b', [B]), column('c', [third])];
  const screen = await renderApp(viewOf([strip('first', columns)], panes));
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 3').element()).x).toBe(56 + 4 + 1196),
  );
  coreShowsWorkspace(
    viewOf([strip('first', columns, { activeColumn: 2 })], panes),
  );
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 3').element()).x).toBe(56 + 602),
  );
  coreShowsWorkspace(
    viewOf([strip('first', columns, { activeColumn: 1 })], panes),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(boxOf(pane(screen, 'agent 3').element()).x).toBe(56 + 602);
});

test('focuses a pane when it is pressed', async () => {
  const screen = await renderApp();
  await expect.element(pane(screen, 'agent 2')).toBeVisible();
  await pane(screen, 'agent 1').getByRole('textbox').click();
  await pane(screen, 'agent 2').getByRole('textbox').click();
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'focusPane', paneId: B }]),
  );
});

test('moves keyboard focus into the pane that gets focus', async () => {
  const screen = await renderApp();
  const first = pane(screen, 'agent 1').getByRole('textbox');
  await expect.element(first).toHaveFocus();
  coreShowsWorkspace(focusedSecond());
  await expect
    .element(pane(screen, 'agent 2').getByRole('textbox'))
    .toHaveFocus();
  const inbox = screen.getByRole('button', { name: 'Inbox' });
  await inbox.click();
  coreShowsWorkspace(twoAgents());
  await new Promise((resolve) => setTimeout(resolve, 50));
  await expect.element(inbox).toHaveFocus();
});

function scrolled(element: Element | null): boolean {
  if (!element) return false;
  return element.scrollLeft !== 0 || scrolled(element.parentElement);
}

test('moves keyboard focus without scrolling the page', async () => {
  const wide = strip(
    'first',
    [column('left', [A]), column('right', [B], { width: 1.5 })],
    { activeColumn: 1 },
  );
  const screen = await renderApp();
  coreShowsWorkspace(viewOf([wide], twoAgents().panes));
  const second = pane(screen, 'agent 2').getByRole('textbox');
  await expect.element(second).toHaveFocus();
  expect(scrolled(second.element())).toBe(false);
});

test('focuses a pane without a text box as a whole', async () => {
  const screen = await renderApp(
    viewOf([strip('first', [column('only', [B])])], [{ id: B, kind: 'empty' }]),
  );
  await expect.element(pane(screen, 'New pane')).toHaveFocus();
  expect(requests().filter(([url]) => url === '/workspace/actions')).toEqual(
    [],
  );
});

test('focuses the canvas pane once its frame takes the focus', async () => {
  const screen = await renderApp({
    ...twoAgents(),
    panes: [agent(A, 'agent 1'), { id: B, kind: 'excalidraw' }],
  });
  const frame = screen.getByTitle('Excalidraw canvas');
  await expect.element(frame).toBeVisible();
  frame.element().focus();
  await vi.waitFor(() =>
    expect(actions()).toEqual([{ action: 'focusPane', paneId: B }]),
  );
  pane(screen, 'agent 1').getByRole('textbox').element().focus();
  window.dispatchEvent(new FocusEvent('blur'));
  screen.getByRole('button', { name: 'Inbox' }).element().focus();
  window.dispatchEvent(new FocusEvent('blur'));
  coreShowsWorkspace(focusedSecond());
  frame.element().focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(actions()).toHaveLength(1);
});

test('stops measuring the strip once it is gone', async () => {
  const measure = vi.spyOn(ViewStore.prototype, 'measure');
  const screen = await renderApp();
  await vi.waitFor(() => expect(measure).toHaveBeenCalled());
  await screen.unmount();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(measure).not.toHaveBeenCalledWith(0, 0);
});

function contentOf(element: Element): HTMLElement {
  const content = element.firstElementChild;
  if (!(content instanceof HTMLElement)) throw new Error('No pane content');
  return content;
}

test('opens a new pane by fading it in from half its size', async () => {
  const screen = await renderApp(
    viewOf([strip('first', [column('left', [A])])], [agent(A, 'agent 1')]),
  );
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 1').element()).x).toBe(60),
  );
  const seen: string[] = [];
  const observer = new MutationObserver(() => {
    const opening = document.querySelector(`[data-pane-id="${B}"]`);
    if (opening) seen.push(contentOf(opening).style.opacity);
  });
  observer.observe(stripElement(), { subtree: true, attributes: true });
  coreShowsWorkspace(twoAgents());
  const opened = pane(screen, 'agent 2');
  await vi.waitFor(() =>
    expect(getComputedStyle(contentOf(opened.element())).opacity).toBe('1'),
  );
  observer.disconnect();
  expect(seen.some((opacity) => Number(opacity) < 1)).toBe(true);
  expect(contentOf(opened.element()).style.transform).toBe('none');
});

const GHOST = '[data-slot="pane"][aria-hidden="true"]';

test('keeps a closed pane in view while it fades out', async () => {
  const screen = await renderApp();
  await measured(screen);
  coreShowsWorkspace(
    viewOf([strip('first', [column('left', [A])])], [agent(A, 'agent 1')]),
  );
  const ghost = await vi.waitFor(() => {
    const closing = stripElement().querySelector(GHOST);
    if (!closing) throw new Error('No closing pane');
    return closing;
  });
  expect(ghost.hasAttribute('data-pane-id')).toBe(false);
  expect(getComputedStyle(ghost).pointerEvents).toBe('none');
  await vi.waitFor(() => expect(ghost.isConnected).toBe(false));
  expect(stripElement().querySelectorAll('[data-slot="pane"]')).toHaveLength(1);
});

test('slides past an empty workspace that core removes on leaving it', async () => {
  const panes = twoAgents().panes;
  const first = strip('first', [column('left', [A])]);
  const third = strip('third', [column('right', [B])]);
  const screen = await renderApp(
    viewOf([first, strip('empty', []), third], panes, { activeWorkspace: 1 }),
  );
  const lower = pane(screen, 'agent 2').element();
  await vi.waitFor(() => expect(boxOf(lower).y).toBe(884));
  coreShowsWorkspace(viewOf([first, third], panes, { activeWorkspace: 1 }));
  const moved = await vi.waitFor(
    () => {
      const { y } = boxOf(lower);
      expect(y).toBeLessThan(884);
      return y;
    },
    { interval: 5 },
  );
  expect(moved).toBeGreaterThan(100);
  await vi.waitFor(() => expect(boxOf(lower).y).toBe(4));
});
