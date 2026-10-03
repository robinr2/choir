import { todoDetail } from './todo-views.js';

const at = Temporal.Instant.from('2026-09-28T08:00:00Z');

it('lists the linked notifications and their attachments', () => {
  const file = { index: 0, filename: 'log.txt', mediaType: 'text/plain' };
  const notification = { id: 'n1', source: 'teams', title: 'Down', sentAt: at };
  expect(
    todoDetail({
      id: 't1',
      title: 'Check',
      description: 'Look at the logs',
      dueAt: null,
      createdAt: at,
      updatedAt: at,
      archivedAt: null,
      notifications: [
        { notification: { ...notification, attachments: [file] } },
        { notification: null },
      ],
    }),
  ).toEqual({
    id: 't1',
    title: 'Check',
    description: 'Look at the logs',
    preview: 'Look at the logs',
    dueAt: null,
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
    notifications: [notification],
    attachments: [{ notificationId: 'n1', ...file }],
  });
});
