import { expect, test, vi } from 'vitest';
import { N1, N2, notification, T1, T2, todo } from '@/test/fake-inbox';
import {
  agentZone,
  changes,
  dragFrom,
  rowOf,
  settle,
  showInbox,
  withFakeCore,
} from '@/test/inbox-screen';
import { dragEvent, dropOutsideAnyDrag, type Screen } from '@/test/render-app';

function at(
  type: string,
  data: DataTransfer,
  row: HTMLElement,
  part: 'upper' | 'lower' | 'middle',
) {
  const box = row.getBoundingClientRect();
  const offsets = { upper: 1, middle: box.height / 2, lower: box.height - 1 };
  const clientY = box.top + offsets[part];
  return new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    dataTransfer: data,
    clientY,
  });
}

function leave(target: Element, relatedTarget: EventTarget | null) {
  target.dispatchEvent(
    new DragEvent('dragleave', { bubbles: true, relatedTarget }),
  );
}

async function shown(screen: Screen, title: string) {
  await expect
    .element(screen.getByRole('article', { name: title }))
    .toBeVisible();
}

const THREE = [
  todo({ id: T1, title: 'first' }),
  todo({ id: T2, title: 'second' }),
  todo({ id: N1, title: 'third' }),
];

withFakeCore();

test('moves an entry above or below the one it is dropped on', async () => {
  const { screen } = await showInbox({ todos: THREE });
  await shown(screen, 'third');
  const data = dragFrom(screen, 'third');
  const first = rowOf(screen, 'first');
  first.dispatchEvent(at('dragover', data, first, 'upper'));
  await expect.poll(() => first.dataset.drop).toBe('before');
  first.dispatchEvent(at('dragover', data, first, 'lower'));
  await expect.poll(() => first.dataset.drop).toBe('after');
  leave(first, first.querySelector('button'));
  await settle();
  expect(first.dataset.drop).toBe('after');
  leave(first, document.body);
  await expect.poll(() => first.dataset.drop).toBeUndefined();
  first.dispatchEvent(at('drop', data, first, 'upper'));
  const second = rowOf(screen, 'second');
  second.dispatchEvent(at('drop', data, second, 'lower'));
  const third = rowOf(screen, 'third');
  third.dispatchEvent(at('drop', data, third, 'upper'));
  await vi.waitFor(() =>
    expect(changes()).toEqual([
      [`/todos/${N1}/position`, 'PUT', { before: T1 }],
      [`/todos/${N1}/position`, 'PUT', { after: T2 }],
    ]),
  );
});

test('shows where the entry will land and takes the drop there', async () => {
  const { screen } = await showInbox({ todos: THREE });
  await shown(screen, 'second');
  const data = dragFrom(screen, 'second');
  const first = rowOf(screen, 'first');
  const middle = at('dragover', data, first, 'middle');
  first.dispatchEvent(middle);
  expect(middle.defaultPrevented).toBe(true);
  await expect.poll(() => first.dataset.drop).toBe('after');
  first.dispatchEvent(at('drop', data, first, 'lower'));
  await expect.poll(() => first.dataset.drop).toBeUndefined();
  await vi.waitFor(() =>
    expect(changes()).toEqual([
      [`/todos/${T2}/position`, 'PUT', { after: T1 }],
    ]),
  );
});

test('keeps the order while a date sorts the notifications and takes no other drags', async () => {
  const { screen, inbox } = await showInbox(
    {
      notifications: [notification(), notification({ id: N2, title: 'Lunch' })],
    },
    'Notifications',
  );
  await shown(screen, 'Lunch');
  expect(rowOf(screen, 'Lunch').draggable).toBe(true);
  const foreign = new DataTransfer();
  foreign.setData('text/plain', 'hello');
  const down = rowOf(screen, 'Production is down');
  down.dispatchEvent(at('dragover', foreign, down, 'upper'));
  await expect.poll(() => down.dataset.drop).toBeUndefined();
  await inbox.getByRole('button', { name: 'Sort' }).last().click();
  await screen.getByRole('menuitemradio', { name: 'Arrival time' }).click();
  await expect
    .element(inbox.getByRole('img', { name: 'Drag to reorder' }))
    .not.toBeInTheDocument();
  expect(rowOf(screen, 'Lunch').draggable).toBe(false);
  const data = dragFrom(screen, 'Lunch');
  down.dispatchEvent(at('dragover', data, down, 'upper'));
  dropOutsideAnyDrag(down, data);
  await expect.poll(() => down.dataset.drop).toBeUndefined();
  expect(changes()).toEqual([]);
});

test('lets to-dos be dragged to agents while a date sorts them', async () => {
  const { screen, inbox } = await showInbox({ todos: [todo()] });
  await shown(screen, 'Check the logs');
  await inbox.getByRole('button', { name: 'Sort' }).first().click();
  await screen.getByRole('menuitemradio', { name: 'Created' }).click();
  await expect
    .element(inbox.getByRole('button', { name: 'Sort' }).first())
    .toHaveTextContent('Created');
  expect(rowOf(screen, 'Check the logs').draggable).toBe(true);
});

test('carries entries under their own types and keeps the drag from the panes', async () => {
  const { screen } = await showInbox({
    notifications: [notification()],
    todos: [todo()],
  });
  await shown(screen, 'Check the logs');
  const reachedPanes = vi.fn<(event: Event) => void>();
  document.addEventListener('dragstart', reachedPanes);
  const todoData = dragFrom(screen, 'Check the logs');
  const notificationData = dragFrom(screen, 'Production is down');
  document.removeEventListener('dragstart', reachedPanes);
  expect(todoData.getData('application/x-choir-todos')).toBe(T1);
  expect(JSON.parse(todoData.getData('application/x-choir-todo'))).toEqual({
    id: T1,
    title: 'Check the logs',
  });
  expect(notificationData.getData('application/x-choir-notifications')).toBe(
    N1,
  );
  expect(notificationData.types).not.toContain('application/x-choir-todo');
  expect(reachedPanes).not.toHaveBeenCalled();
});

test('drops a notification neither on an agent nor among the to-dos', async () => {
  const { screen } = await showInbox({
    notifications: [notification()],
    todos: [todo()],
  });
  await shown(screen, 'Check the logs');
  const data = dragFrom(screen, 'Production is down');
  const logs = rowOf(screen, 'Check the logs');
  logs.dispatchEvent(at('dragover', data, logs, 'upper'));
  dropOutsideAnyDrag(logs, data);
  const { input, zone } = agentZone(screen, 'agent 1');
  dropOutsideAnyDrag(zone, data);
  await settle();
  expect(logs.dataset.drop).toBeUndefined();
  await expect.element(input).toHaveValue('');
  expect(changes()).toEqual([]);
});

test('hands a to-do dropped on an agent to its input box and archives it', async () => {
  const { screen } = await showInbox({ todos: [todo()] });
  await shown(screen, 'Check the logs');
  const { input, zone } = agentZone(screen, 'agent 1');
  await input.fill('Please: ');
  const foreign = new DataTransfer();
  foreign.setData('application/x-other', 'x');
  zone.dispatchEvent(dragEvent('dragover', foreign));
  dropOutsideAnyDrag(zone, foreign);
  await settle();
  expect(zone.getAttribute('data-todo-target')).toBe('false');
  const data = dragFrom(screen, 'Check the logs');
  const over = dragEvent('dragover', data);
  zone.dispatchEvent(over);
  expect(over.defaultPrevented).toBe(true);
  leave(zone, input.element());
  await settle();
  expect(zone.getAttribute('data-todo-target')).toBe('true');
  leave(zone, document.body);
  await expect.poll(() => zone.getAttribute('data-todo-target')).toBe('false');
  zone.dispatchEvent(dragEvent('dragover', data));
  zone.dispatchEvent(dragEvent('drop', data));
  await settle();
  expect(zone.getAttribute('data-todo-target')).toBe('false');
  await expect
    .element(input)
    .toHaveValue(`Please: To-do "Check the logs" (ID ${T1})`);
  await vi.waitFor(() =>
    expect(changes()).toEqual([[`/todos/${T1}`, 'PATCH', { archived: true }]]),
  );
});

test('puts a to-do reference into an empty input box', async () => {
  const { screen } = await showInbox({ todos: [todo()] });
  await shown(screen, 'Check the logs');
  const { input, zone } = agentZone(screen, 'agent 2');
  zone.dispatchEvent(dragEvent('drop', dragFrom(screen, 'Check the logs')));
  await expect.element(input).toHaveValue(`To-do "Check the logs" (ID ${T1})`);
});
