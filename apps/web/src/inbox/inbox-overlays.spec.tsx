import { expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  coreCounts,
  coreHasInbox,
  N1,
  N2,
  notification,
  T1,
  T2,
  todo,
} from '@/test/fake-inbox';
import {
  changes,
  openEntry,
  openInbox,
  showInbox,
  withFakeCore,
} from '@/test/inbox-screen';
import { renderApp } from '@/test/render-app';
import { dateTime } from './inbox-time';

const DOWN = notification({
  link: 'https://outlook.example/mail/1',
  attachments: [
    { index: 0, filename: 'graph.png', mediaType: 'image/png' },
    { index: 1, filename: 'log.txt', mediaType: 'text/plain' },
  ],
});

const LINKED = {
  id: N1,
  source: 'outlook',
  title: 'Production is down',
  sentAt: DOWN.sentAt,
};

withFakeCore();

test('opens a notification with its text, images, attachments and a link to the original', async () => {
  const { screen } = await showInbox(
    { notifications: [DOWN] },
    'Notifications',
  );
  const dialog = await openEntry(screen, 'Production is down');
  await expect
    .element(
      dialog.getByText(
        'Hi Sam, production is down since eight in the morning.',
      ),
    )
    .toBeVisible();
  await expect
    .element(dialog.getByText(`outlook · ${dateTime(DOWN.sentAt)}`))
    .toBeVisible();
  await expect
    .element(dialog.getByRole('img', { name: 'graph.png' }))
    .toHaveAttribute('src', `/notifications/${N1}/attachments/0`);
  await expect
    .element(dialog.getByRole('link', { name: 'log.txt' }))
    .toHaveAttribute('href', `/notifications/${N1}/attachments/1`);
  await expect
    .element(dialog.getByRole('link', { name: 'Open original' }))
    .toHaveAttribute('href', 'https://outlook.example/mail/1');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
});

test('opens a notification without attachments or a link', async () => {
  const { screen } = await showInbox(
    { notifications: [notification()] },
    'Notifications',
  );
  const dialog = await openEntry(screen, 'Production is down');
  await expect
    .element(dialog.getByText(/production is down since eight in the morning/))
    .toBeVisible();
  await expect.element(dialog.getByRole('link')).not.toBeInTheDocument();
  await expect
    .element(dialog.getByRole('list', { name: 'Attachments' }))
    .not.toBeInTheDocument();
});

test('shows images as images and every other attachment as a file, as they change', async () => {
  const { screen } = await showInbox(
    { notifications: [DOWN] },
    'Notifications',
  );
  const dialog = await openEntry(screen, 'Production is down');
  await expect
    .element(dialog.getByRole('img'))
    .toHaveAttribute('alt', 'graph.png');
  await expect
    .element(dialog.getByRole('link', { name: 'graph.png' }))
    .not.toBeInTheDocument();
  await expect
    .element(dialog.getByRole('img', { name: 'log.txt' }))
    .not.toBeInTheDocument();
  const more = {
    index: 2,
    filename: 'notes.pdf',
    mediaType: 'application/pdf',
  };
  coreHasInbox({
    notifications: [{ ...DOWN, attachments: [...DOWN.attachments, more] }],
  });
  coreCounts(1, 0);
  await expect
    .element(dialog.getByRole('link', { name: 'notes.pdf' }))
    .toBeVisible();
});

test('makes a to-do from a notification, linked to it and titled after it', async () => {
  const { screen, inbox } = await showInbox(
    { notifications: [notification()] },
    'Notifications',
  );
  await inbox.getByRole('button', { name: 'Make to-do' }).click();
  const dialog = screen.getByRole('dialog', { name: 'New to-do' });
  await expect
    .element(dialog.getByText('From outlook: Production is down'))
    .toBeVisible();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Title' }))
    .toHaveValue('Production is down');
  await dialog
    .getByRole('textbox', { name: 'Title' })
    .fill('Check why production is down');
  await dialog
    .getByRole('textbox', { name: 'Description' })
    .fill('Start with the logs.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  expect(changes()).toEqual([
    [
      '/todos',
      'POST',
      {
        title: 'Check why production is down',
        description: 'Start with the logs.',
        dueAt: null,
        notificationIds: [N1],
      },
    ],
  ]);
});

test('makes a to-do titled after the notification as it is now', async () => {
  const { screen, inbox } = await showInbox(
    { notifications: [notification()] },
    'Notifications',
  );
  await expect
    .element(inbox.getByRole('article', { name: 'Production is down' }))
    .toBeVisible();
  coreHasInbox({
    notifications: [notification({ title: 'Production is up again' })],
  });
  coreCounts(1, 0);
  await inbox
    .getByRole('article', { name: 'Production is up again' })
    .getByRole('button', { name: 'Make to-do' })
    .click();
  await expect
    .element(
      screen
        .getByRole('dialog', { name: 'New to-do' })
        .getByRole('textbox', { name: 'Title' }),
    )
    .toHaveValue('Production is up again');
});

test('adds a notification to one of the active to-dos, or says there is none', async () => {
  const done = todo({
    id: T2,
    title: 'Done already',
    archivedAt: '2026-09-28T08:00:00Z',
  });
  const { screen, inbox } = await showInbox(
    { notifications: [notification()], todos: [done] },
    'Notifications',
  );
  await inbox.getByRole('button', { name: 'Add to to-do' }).click();
  await expect
    .element(screen.getByRole('menuitem', { name: 'No active to-dos' }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  coreHasInbox({ notifications: [notification()], todos: [todo(), done] });
  coreCounts(1, 1);
  await inbox.getByRole('button', { name: 'Add to to-do' }).click();
  await expect
    .element(screen.getByRole('menuitem', { name: 'Done already' }))
    .not.toBeInTheDocument();
  await screen.getByRole('menuitem', { name: 'Check the logs' }).click();
  await vi.waitFor(() =>
    expect(changes()).toEqual([
      [`/todos/${T1}/notifications`, 'POST', { notificationId: N1 }],
    ]),
  );
});

test('archives entries and takes them out of the archive', async () => {
  const old = notification({
    id: N2,
    title: 'Old',
    archivedAt: '2026-09-28T08:00:00Z',
  });
  const { inbox } = await showInbox({
    notifications: [notification(), old],
    todos: [todo()],
  });
  await inbox
    .getByRole('article', { name: 'Check the logs' })
    .getByRole('button', { name: 'Archive' })
    .click();
  await inbox.getByRole('button', { name: 'Notifications' }).click();
  await inbox.getByRole('switch').last().click();
  await inbox
    .getByRole('article', { name: 'Old' })
    .getByRole('button', { name: 'Restore' })
    .click();
  await inbox
    .getByRole('article', { name: 'Production is down' })
    .getByRole('button', { name: 'Archive' })
    .click();
  await vi.waitFor(() =>
    expect(changes()).toEqual([
      [`/todos/${T1}`, 'PATCH', { archived: true }],
      [`/notifications/${N2}`, 'PATCH', { archived: false }],
      [`/notifications/${N1}`, 'PATCH', { archived: true }],
    ]),
  );
});

test('edits a to-do and shows what it links to', async () => {
  const due = new Date(2026, 9, 1, 17, 0).toISOString();
  const attachments = [
    {
      notificationId: N1,
      index: 1,
      filename: 'log.txt',
      mediaType: 'text/plain',
    },
  ];
  const { screen } = await showInbox({
    notifications: [DOWN],
    todos: [todo({ dueAt: due, notifications: [LINKED], attachments })],
  });
  const dialog = await openEntry(screen, 'Check the logs');
  await expect
    .element(dialog.getByText(/^Created .* · Last change /))
    .toBeVisible();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Description' }))
    .toHaveValue('Look at the login service first.');
  await expect
    .element(dialog.getByLabelText('Due'))
    .toHaveValue('2026-10-01T17:00');
  await expect
    .element(dialog.getByRole('link', { name: 'log.txt' }))
    .toBeVisible();
  await dialog
    .getByRole('textbox', { name: 'Title' })
    .fill('Check the login logs');
  await dialog.getByLabelText('Due').fill('');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await vi.waitFor(() =>
    expect(changes()).toEqual([
      [
        `/todos/${T1}`,
        'PATCH',
        {
          title: 'Check the login logs',
          description: 'Look at the login service first.',
          dueAt: null,
        },
      ],
    ]),
  );
  await expect.element(dialog).not.toBeInTheDocument();
});

test('opens a linked notification from its to-do', async () => {
  const { screen } = await showInbox({
    notifications: [DOWN],
    todos: [todo({ notifications: [LINKED] })],
  });
  await openEntry(screen, 'Check the logs');
  const linked = screen.getByRole('list', { name: 'Linked notifications' });
  await expect
    .element(linked.getByText(`outlook · ${dateTime(DOWN.sentAt)}`))
    .toBeVisible();
  await linked.getByRole('button', { name: /Production is down/ }).click();
  await expect
    .element(screen.getByRole('dialog', { name: 'Production is down' }))
    .toBeVisible();
});

test('opens a to-do that links no notification and archives it', async () => {
  const { screen } = await showInbox({ todos: [todo()] });
  const dialog = await openEntry(screen, 'Check the logs');
  await expect
    .element(dialog.getByRole('textbox', { name: 'Title' }))
    .toHaveValue('Check the logs');
  await expect
    .element(dialog.getByRole('list', { name: 'Linked notifications' }))
    .not.toBeInTheDocument();
  await dialog.getByRole('button', { name: 'Archive' }).click();
  await vi.waitFor(() =>
    expect(changes()).toEqual([[`/todos/${T1}`, 'PATCH', { archived: true }]]),
  );
});

test('creates a to-do from scratch, starting empty', async () => {
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  await inbox.getByRole('button', { name: 'New to-do' }).click();
  const dialog = screen.getByRole('dialog', { name: 'New to-do' });
  await expect.element(dialog.getByText(/^From /)).not.toBeInTheDocument();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Title' }))
    .toHaveValue('');
  await expect
    .element(dialog.getByRole('textbox', { name: 'Description' }))
    .toHaveValue('');
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Call Anna');
  await dialog.getByLabelText('Due').fill('2026-10-01T09:30');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await vi.waitFor(() =>
    expect(changes()).toEqual([
      [
        '/todos',
        'POST',
        {
          title: 'Call Anna',
          description: '',
          dueAt: new Date(2026, 9, 1, 9, 30).toISOString(),
          notificationIds: [],
        },
      ],
    ]),
  );
});

test('makes a to-do from within an open notification', async () => {
  const { screen } = await showInbox(
    { notifications: [notification()] },
    'Notifications',
  );
  const dialog = await openEntry(screen, 'Production is down');
  await dialog.getByRole('button', { name: 'Make to-do' }).click();
  await expect
    .element(screen.getByRole('dialog', { name: 'New to-do' }))
    .toBeVisible();
});

test('archives and restores an entry as it is now', async () => {
  const { inbox } = await showInbox({ todos: [todo()] });
  await inbox.getByRole('switch', { name: 'Show archived' }).first().click();
  const entry = inbox.getByRole('article', { name: 'Check the logs' });
  await entry.getByRole('button', { name: 'Archive' }).click();
  coreHasInbox({ todos: [todo({ archivedAt: '2026-09-28T08:00:00Z' })] });
  coreCounts(0, 0);
  await entry.getByRole('button', { name: 'Restore' }).click();
  await vi.waitFor(() =>
    expect(changes()).toEqual([
      [`/todos/${T1}`, 'PATCH', { archived: true }],
      [`/todos/${T1}`, 'PATCH', { archived: false }],
    ]),
  );
});
