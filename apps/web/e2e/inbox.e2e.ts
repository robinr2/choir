import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const CORE = 'http://localhost:3000';

async function openInbox(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Inbox' }).click();
  return page.getByRole('complementary', { name: 'Inbox' });
}

test('shows a notification a connector pushes, with its source', async ({
  page,
  request,
}) => {
  const title = `Release ${randomUUID()}`;
  const pushed = await request.post(`${CORE}/notifications`, {
    headers: { 'Content-Type': 'application/cloudevents+json' },
    data: {
      specversion: '1.0',
      id: randomUUID(),
      source: 'e2e',
      type: 'choir.notification.v1',
      time: new Date().toISOString(),
      data: { title, text: 'The release is out.' },
    },
  });
  expect(pushed.status()).toBe(201);
  const inbox = await openInbox(page);
  await inbox.getByRole('button', { name: 'Notifications' }).click();
  await inbox.getByRole('switch', { name: 'Show archived' }).last().click();
  const entry = inbox.getByRole('article', { name: title });
  await expect(entry).toBeVisible();
  await expect(entry.getByText(/^e2e · /)).toBeVisible();
});

async function newTodo(page: Page, title: string) {
  const inbox = await openInbox(page);
  await inbox.getByRole('button', { name: 'New to-do' }).click();
  const dialog = page.getByRole('dialog', { name: 'New to-do' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill(title);
  await dialog.getByRole('button', { name: 'Save' }).click();
  return inbox.getByRole('article', { name: title });
}

test('hands a to-do to an agent by dragging it onto the agent', async ({
  page,
}) => {
  const title = `Check the logs ${randomUUID()}`;
  const entry = await newTodo(page, title);
  await expect(entry).toBeVisible();
  const agent = page.locator('section[data-kind="agent"]').first();
  await entry.locator('..').dragTo(agent.getByRole('textbox'));
  await expect(agent.getByRole('textbox')).toHaveValue(
    new RegExp(`^To-do "${title}" \\(ID [0-9a-f-]{36}\\)$`),
  );
  await expect(entry).toHaveCount(0);
});
