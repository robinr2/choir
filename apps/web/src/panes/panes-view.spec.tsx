import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  A,
  B,
  coreShowsWorkspace,
  fakeCore,
  twoAgents,
} from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import {
  dragEvent,
  dropOutsideAnyDrag,
  pane,
  renderApp,
} from '@/test/render-app';

function requestsWith(method: string) {
  return requests().filter(([, used]) => used === method);
}

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

function dropTargetOf(element: Element): string | null {
  return element.getAttribute('data-drop-target');
}

const errors: ErrorEvent[] = [];
const escaped: string[] = [];

function recordError(error: ErrorEvent): void {
  errors.push(error);
}

function recordEscape(event: Event): void {
  escaped.push(event.type);
}

const DRAGS = ['dragstart', 'dragover', 'drop'];

beforeEach(() => {
  fakeCore();
  errors.length = 0;
  escaped.length = 0;
  window.addEventListener('error', recordError);
  for (const type of DRAGS) window.addEventListener(type, recordEscape);
});

afterEach(() => {
  window.removeEventListener('error', recordError);
  for (const type of DRAGS) window.removeEventListener(type, recordEscape);
  if (errors.length > 0)
    throw new Error(errors.map(({ message }) => message).join(', '));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('shows every agent in its own pane, laid out as core says', async () => {
  const screen = await renderApp();
  await expect.element(pane(screen, 'agent 1')).toBeVisible();
  await expect
    .element(pane(screen, 'agent 2').getByText('working'))
    .toBeVisible();
  await expect
    .element(pane(screen, 'agent 1').getByText('working'))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole('link', { name: 'Agents' }))
    .toHaveAttribute('aria-current', 'page');
  const left = pane(screen, 'agent 1').element().getBoundingClientRect();
  const right = pane(screen, 'agent 2').element().getBoundingClientRect();
  expect(left.right).toBeLessThanOrEqual(right.left);
  await expect.element(pane(screen, 'agent 1')).toHaveClass('rounded-lg');
  await expect.element(pane(screen, 'agent 1')).not.toHaveClass('ring-2');
  await expect
    .element(pane(screen, 'agent 1'))
    .not.toHaveClass('border-active/50');
  expect(document.activeElement?.tagName).not.toBe('TEXTAREA');
});

test('draws the plus bars along the outer edges', async () => {
  const screen = await renderApp();
  const bar = (name: string) => screen.getByRole('button', { name });
  await expect.element(bar('Add a row at the top')).toHaveClass('col-span-3');
  await expect
    .element(bar('Add a row at the bottom'))
    .toHaveClass('col-span-3');
  await expect.element(bar('Add a column on the left')).toHaveClass('w-5');
  await expect
    .element(bar('Add a column on the right'))
    .not.toHaveClass('col-span-3');
  await expect
    .element(bar('Add a column on the right'))
    .toHaveClass('border-dashed');
});

test('says so when there are no panes', async () => {
  const screen = await renderApp({
    layout: null,
    panes: [],
    voiceAgentId: null,
  });
  await expect
    .element(screen.getByText('No panes. Add one from an edge.'))
    .toBeVisible();
});

test('shows nothing for a pane it does not know', async () => {
  const screen = await renderApp({ ...twoAgents(), panes: [] });
  await expect.element(pane(screen, 'agent 1')).not.toBeInTheDocument();
});

test('adds empty panes from the outer edges and by splitting a pane', async () => {
  const screen = await renderApp();
  await screen.getByRole('button', { name: 'Add a row at the top' }).click();
  await screen.getByRole('button', { name: 'Add a row at the bottom' }).click();
  await screen
    .getByRole('button', { name: 'Add a column on the left' })
    .click();
  await screen
    .getByRole('button', { name: 'Add a column on the right' })
    .click();
  await pane(screen, 'agent 1')
    .getByRole('button', { name: 'Split vertically' })
    .click();
  await pane(screen, 'agent 2')
    .getByRole('button', { name: 'Split horizontally' })
    .click();
  await vi.waitFor(() =>
    expect(requestsWith('POST')).toEqual([
      ['/workspace/edges', 'POST', { edge: 'top' }],
      ['/workspace/edges', 'POST', { edge: 'bottom' }],
      ['/workspace/edges', 'POST', { edge: 'left' }],
      ['/workspace/edges', 'POST', { edge: 'right' }],
      ['/workspace/splits', 'POST', { paneId: A, direction: 'vertical' }],
      ['/workspace/splits', 'POST', { paneId: B, direction: 'horizontal' }],
    ]),
  );
});

test('closes a pane', async () => {
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

test('swaps two panes when one is dropped on the other', async () => {
  const screen = await renderApp();
  const title = pane(screen, 'agent 1')
    .element()
    .querySelector('[data-slot="pane-title"]');
  const source = pane(screen, 'agent 1').element();
  const target = pane(screen, 'agent 2').element();
  const data = new DataTransfer();
  expect(title?.dispatchEvent(dragEvent('dragstart', data))).toBe(true);
  expect(target.dispatchEvent(dragEvent('dragover', data))).toBe(false);
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-drop-target', 'true');
  await expect.element(pane(screen, 'agent 2')).toHaveClass('ring-2');
  source.dispatchEvent(dragEvent('dragover', data));
  dropOutsideAnyDrag(source, data);
  await settled();
  expect(dropTargetOf(source)).toBe('false');
  expect(requests()).toEqual([]);
  expect(target.dispatchEvent(dragEvent('drop', data))).toBe(false);
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-drop-target', 'false');
  await vi.waitFor(() =>
    expect(requests()).toEqual([
      ['/workspace/swaps', 'POST', { first: A, second: B }],
    ]),
  );
  expect(escaped).toEqual(['dragover']);
});

test('highlights a pane only while another pane is dragged over it', async () => {
  const screen = await renderApp();
  const target = pane(screen, 'agent 2').element();
  const data = new DataTransfer();
  data.setData('application/x-choir-pane', A);
  target.dispatchEvent(dragEvent('dragover', data));
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-drop-target', 'true');
  const inside = pane(screen, 'agent 2').getByRole('textbox').element();
  target.dispatchEvent(
    new DragEvent('dragleave', { bubbles: true, relatedTarget: inside }),
  );
  await settled();
  expect(dropTargetOf(target)).toBe('true');
  target.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
  await expect
    .element(pane(screen, 'agent 2'))
    .toHaveAttribute('data-drop-target', 'false');
  const text = new DataTransfer();
  text.setData('text/plain', 'hello');
  target.dispatchEvent(dragEvent('dragover', text));
  dropOutsideAnyDrag(target, text);
  await settled();
  expect(dropTargetOf(target)).toBe('false');
  expect(requests()).toEqual([]);
});

test('resizes panes and tells core once the split is released', async () => {
  const screen = await renderApp();
  const bar = document.querySelector('.mosaic-split');
  const box = bar?.getBoundingClientRect() ?? new DOMRect();
  const y = box.top + box.height / 2;
  const at = (clientX: number) => ({ bubbles: true, clientX, clientY: y });
  bar?.dispatchEvent(new MouseEvent('mousedown', at(box.left)));
  document.dispatchEvent(new MouseEvent('mousemove', at(box.left - 100)));
  document.dispatchEvent(new MouseEvent('mouseup', at(box.left - 100)));
  await vi.waitFor(() =>
    expect(requestsWith('PUT')).toEqual([
      [
        '/workspace/layout',
        'PUT',
        { layout: expect.objectContaining({ children: [A, B] }) },
      ],
    ]),
  );
  const left = pane(screen, 'agent 1').element().getBoundingClientRect();
  const right = pane(screen, 'agent 2').element().getBoundingClientRect();
  expect(left.width).toBeLessThan(right.width);
  coreShowsWorkspace({ ...twoAgents(), layout: A });
  await expect.element(pane(screen, 'agent 2')).not.toBeInTheDocument();
});
