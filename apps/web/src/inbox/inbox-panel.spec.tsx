import { expect, test } from 'vitest';
import { openInbox, withFakeCore } from '@/test/inbox-screen';
import { requests } from '@/test/fake-event-source';
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
import { renderApp, type Screen } from '@/test/render-app';
import { dateTime } from './inbox-time';

function titlesIn(screen: Screen, list: string): string[] {
  const items = screen
    .getByRole('list', { name: list })
    .element()
    .querySelectorAll('article');
  return [...items].map((item) => item.getAttribute('aria-label') ?? '');
}

withFakeCore();

test('shows how many notifications and to-dos are active without opening the inbox', async () => {
  const screen = await renderApp();
  await expect
    .element(screen.getByRole('status', { name: '0 active notifications' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('status', { name: '0 active to-dos' }))
    .toHaveAttribute('data-active', 'false');
  coreCounts(3, 12);
  await expect
    .element(screen.getByRole('status', { name: '3 active notifications' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('status', { name: '12 active to-dos' }))
    .toHaveAttribute('data-active', 'true');
});

test('opens the inbox on the to-dos and closes it again', async () => {
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  await expect
    .element(screen.getByRole('button', { name: 'Inbox' }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .element(inbox.getByRole('heading', { name: 'To-dos' }))
    .toBeVisible();
  await expect.element(inbox.getByText('No to-dos')).toBeVisible();
  await screen.getByRole('button', { name: 'Inbox' }).click();
  await expect.element(inbox).not.toBeInTheDocument();
});

test('switches between the to-dos and the notifications', async () => {
  coreHasInbox({ notifications: [notification()], todos: [todo()] });
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  await inbox.getByRole('button', { name: 'Notifications' }).click();
  await expect
    .element(inbox.getByRole('heading', { name: 'Notifications' }))
    .toBeVisible();
  await expect
    .element(inbox.getByRole('button', { name: 'Notifications' }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .element(inbox.getByRole('article', { name: 'Production is down' }))
    .toBeVisible();
  await expect
    .element(inbox.getByRole('article', { name: 'Check the logs' }))
    .not.toBeInTheDocument();
  await expect
    .element(inbox.getByRole('button', { name: 'To-dos' }))
    .toHaveAttribute('aria-pressed', 'false');
  await inbox.getByRole('button', { name: 'To-dos' }).click();
  await expect
    .element(inbox.getByRole('article', { name: 'Check the logs' }))
    .toBeVisible();
});

test('shows each entry with its title, the start of its text and its time', async () => {
  const due = '2026-10-01T15:00:00Z';
  coreHasInbox({
    notifications: [notification({ source: 'teams' })],
    todos: [
      todo(),
      todo({
        id: T2,
        title: 'Call Anna',
        preview: 'About the offer',
        dueAt: due,
      }),
    ],
  });
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  const logs = inbox.getByRole('article', { name: 'Check the logs' });
  await expect
    .element(logs.getByText('Look at the login service first.'))
    .toBeVisible();
  await expect
    .element(logs.getByText(`Created ${dateTime('2026-09-28T07:00:00Z')}`))
    .toBeVisible();
  const call = inbox.getByRole('article', { name: 'Call Anna' });
  await expect.element(call.getByText(`Due ${dateTime(due)}`)).toBeVisible();
  await inbox.getByRole('button', { name: 'Notifications' }).click();
  const down = inbox.getByRole('article', { name: 'Production is down' });
  await expect
    .element(down.getByText('Hi Sam, production is down since eight …'))
    .toBeVisible();
  await expect
    .element(down.getByText(`teams · ${dateTime('2026-09-28T06:14:00Z')}`))
    .toBeVisible();
  await inbox.getByRole('switch').last().click();
  await expect
    .element(inbox.getByText('No notifications'))
    .not.toBeInTheDocument();
});

test('searches the entries and shows the archived ones when asked', async () => {
  const archived = '2026-09-28T08:00:00Z';
  coreHasInbox({
    todos: [todo(), todo({ id: T2, title: 'Call Anna', archivedAt: archived })],
  });
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  await expect
    .poll(() => titlesIn(screen, 'To-dos'))
    .toEqual(['Check the logs']);
  await inbox.getByRole('switch', { name: 'Show archived' }).first().click();
  await expect
    .poll(() => titlesIn(screen, 'To-dos'))
    .toEqual(['Check the logs', 'Call Anna']);
  const call = inbox.getByRole('article', { name: 'Call Anna' });
  await expect
    .element(call.getByRole('button', { name: 'Restore' }))
    .toBeVisible();
  await inbox.getByRole('searchbox', { name: 'Search to-dos' }).fill('  anna ');
  await expect.poll(() => titlesIn(screen, 'To-dos')).toEqual(['Call Anna']);
  expect(requests().map(([url]) => url)).toContain(
    '/todos?archived=true&search=anna',
  );
});

test('sorts by a date field and brings the order of the user back unchanged', async () => {
  coreHasInbox({
    todos: [
      todo({ id: T1, title: 'later', dueAt: '2026-10-05T10:00:00Z' }),
      todo({ id: T2, title: 'undated' }),
      todo({ id: N1, title: 'sooner', dueAt: '2026-10-01T10:00:00Z' }),
    ],
  });
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  await expect
    .poll(() => titlesIn(screen, 'To-dos'))
    .toEqual(['later', 'undated', 'sooner']);
  await expect
    .element(inbox.getByRole('img', { name: 'Drag to reorder' }).first())
    .toBeVisible();
  await expect
    .element(inbox.getByRole('img', { name: 'ascending' }))
    .not.toBeInTheDocument();
  await inbox.getByRole('button', { name: 'Sort' }).first().click();
  await expect
    .element(screen.getByRole('menuitemradio', { name: 'Ascending' }))
    .toBeDisabled();
  await screen.getByRole('menuitemradio', { name: 'Due date' }).click();
  await expect
    .poll(() => titlesIn(screen, 'To-dos'))
    .toEqual(['sooner', 'later', 'undated']);
  await expect
    .element(inbox.getByRole('img', { name: 'Drag to reorder' }))
    .not.toBeInTheDocument();
  await expect
    .element(inbox.getByRole('button', { name: 'Sort' }).first())
    .toHaveTextContent('Due date');
  await expect
    .element(inbox.getByRole('img', { name: 'ascending' }))
    .toBeVisible();
  await screen.getByRole('menuitemradio', { name: 'Descending' }).click();
  await expect
    .poll(() => titlesIn(screen, 'To-dos'))
    .toEqual(['later', 'sooner', 'undated']);
  await expect
    .element(inbox.getByRole('img', { name: 'descending' }))
    .toBeVisible();
  await screen.getByRole('menuitemradio', { name: 'My order' }).click();
  await expect
    .poll(() => titlesIn(screen, 'To-dos'))
    .toEqual(['later', 'undated', 'sooner']);
});

test('offers the arrival time as the date to sort notifications by', async () => {
  coreHasInbox({
    notifications: [
      notification({ id: N1, title: 'old', sentAt: '2026-09-27T06:00:00Z' }),
      notification({ id: N2, title: 'new', sentAt: '2026-09-28T06:00:00Z' }),
    ],
  });
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  await inbox.getByRole('button', { name: 'Notifications' }).click();
  await inbox.getByRole('button', { name: 'Sort' }).last().click();
  await expect
    .element(screen.getByRole('menuitemradio', { name: 'Due date' }))
    .not.toBeInTheDocument();
  await screen.getByRole('menuitemradio', { name: 'Arrival time' }).click();
  await screen.getByRole('menuitemradio', { name: 'Descending' }).click();
  await expect
    .poll(() => titlesIn(screen, 'Notifications'))
    .toEqual(['new', 'old']);
});

test('shows what changed in core', async () => {
  const screen = await renderApp();
  await openInbox(screen);
  coreHasInbox({ todos: [todo()] });
  coreCounts(0, 1);
  await expect
    .poll(() => titlesIn(screen, 'To-dos'))
    .toEqual(['Check the logs']);
});

test('keeps the direction when the date field changes', async () => {
  coreHasInbox({
    todos: [
      todo({ id: T1, title: 'old', updatedAt: '2026-09-27T07:00:00Z' }),
      todo({ id: T2, title: 'new', updatedAt: '2026-09-28T07:00:00Z' }),
    ],
  });
  const screen = await renderApp();
  const inbox = await openInbox(screen);
  const sort = inbox.getByRole('button', { name: 'Sort' }).first();
  await sort.click();
  await screen.getByRole('menuitemradio', { name: 'Due date' }).click();
  await screen.getByRole('menuitemradio', { name: 'Descending' }).click();
  await screen.getByRole('menuitemradio', { name: 'Last change' }).click();
  await expect.element(sort).toHaveTextContent('Last change');
  await expect
    .element(inbox.getByRole('img', { name: 'descending' }))
    .toBeVisible();
  await expect.poll(() => titlesIn(screen, 'To-dos')).toEqual(['new', 'old']);
});
