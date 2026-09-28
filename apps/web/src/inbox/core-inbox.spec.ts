import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fakeEventSources, requests, streamOf } from '@/test/fake-event-source';
import { attachmentUrl, CoreInbox, listPath } from './core-inbox';

beforeEach(() => {
  fakeEventSources();
  vi.spyOn(window, 'fetch').mockImplementation(async () =>
    Response.json({ id: 't1' }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('counts the active entries and moves to a new revision with every change', () => {
  const inbox = new CoreInbox();
  expect(inbox.getSnapshot()).toEqual({
    notifications: 0,
    todos: 0,
    revision: 0,
  });
  const stop = inbox.subscribe(() => undefined);
  streamOf('/inbox/events')?.receive({ notifications: 2, todos: 1 });
  streamOf('/inbox/events')?.receive({ notifications: 2, todos: 3 });
  expect(inbox.getSnapshot()).toEqual({
    notifications: 2,
    todos: 3,
    revision: 2,
  });
  stop();
});

test('reads each path once per revision', async () => {
  const inbox = new CoreInbox();
  const first = inbox.read('/todos/t1', 1);
  expect(inbox.read('/todos/t1', 1)).toBe(first);
  expect(await first).toEqual({ id: 't1' });
  const next = inbox.read('/todos/t1', 2);
  expect(next).not.toBe(first);
  expect(inbox.read('/todos/t2', 2)).not.toBe(next);
  expect(requests().map(([url, method]) => [url, method])).toEqual([
    ['/todos/t1', 'GET'],
    ['/todos/t1', 'GET'],
    ['/todos/t2', 'GET'],
  ]);
});

test('sends the changes of the user to core', async () => {
  const inbox = new CoreInbox();
  const draft = { title: 'Call', description: '', dueAt: null };
  await inbox.archive('notifications', 'n1', true);
  await inbox.move('todos', 't1', { before: 't2' });
  expect(await inbox.createTodo({ ...draft, notificationIds: ['n1'] })).toEqual(
    { id: 't1' },
  );
  expect(await inbox.updateTodo('t1', draft)).toEqual({ id: 't1' });
  expect(await inbox.link('t1', 'n2')).toEqual({ id: 't1' });
  expect(requests()).toEqual([
    ['/notifications/n1', 'PATCH', { archived: true }],
    ['/todos/t1/position', 'PUT', { before: 't2' }],
    ['/todos', 'POST', { ...draft, notificationIds: ['n1'] }],
    ['/todos/t1', 'PATCH', draft],
    ['/todos/t1/notifications', 'POST', { notificationId: 'n2' }],
  ]);
});

test('addresses lists and attachments', () => {
  expect(listPath('todos', { archived: true, search: 'a&b' })).toBe(
    '/todos?archived=true&search=a%26b',
  );
  expect(attachmentUrl('n1', 2)).toBe('/notifications/n1/attachments/2');
});
