import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ElicitationPart } from '@/conversation/transcript';
import { A, fakeCore } from '@/test/fake-core';
import { coreReplied, interactions, renderChat } from '@/test/render-chat';

const FORM: ElicitationPart = {
  type: 'elicitation',
  id: 'e1',
  server: null,
  message: 'Where should the notes go?',
  mode: 'form',
  state: 'request',
  fields: [
    { name: 'repo', label: 'Repository', kind: 'text', required: true },
    {
      name: 'color',
      label: 'Color',
      kind: 'choice',
      options: ['red', 'blue'],
      required: false,
    },
    { name: 'notify', label: 'Notify', kind: 'toggle', required: false },
    { name: 'count', label: 'Count', kind: 'number', required: false },
  ],
};

const SIGN_IN: ElicitationPart = {
  type: 'elicitation',
  id: 'e2',
  server: 'github',
  message: 'Sign in to GitHub',
  mode: 'url',
  url: 'https://example.com/login',
  state: 'request',
  fields: [],
};

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('fills in and sends a form an MCP server asks for', async () => {
  const screen = await renderChat(A);
  coreReplied(A, FORM);
  await expect
    .element(screen.getByText('Where should the notes go?'))
    .toBeVisible();
  await screen.getByRole('textbox', { name: 'Repository' }).fill('choir');
  await screen.getByRole('button', { name: 'blue' }).click();
  await expect
    .element(screen.getByRole('button', { name: 'blue' }))
    .toHaveAttribute('aria-pressed', 'true');
  await screen.getByRole('switch', { name: 'Notify' }).click();
  await screen.getByRole('spinbutton', { name: 'Count' }).fill('3');
  await screen.getByRole('button', { name: 'Send' }).click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [
        `/conversations/${A}/interactions/e1`,
        'POST',
        {
          action: 'accept',
          content: { repo: 'choir', color: 'blue', notify: true, count: 3 },
        },
      ],
    ]),
  );
});

test('declines a form', async () => {
  const screen = await renderChat(A);
  coreReplied(A, FORM);
  await screen.getByRole('button', { name: 'Decline' }).click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [`/conversations/${A}/interactions/e1`, 'POST', { action: 'decline' }],
    ]),
  );
});

test('opens a sign-in page in a new tab and accepts', async () => {
  const screen = await renderChat(A);
  coreReplied(A, SIGN_IN);
  const link = screen.getByRole('link', { name: 'Open sign-in page' });
  await expect
    .element(screen.getByText('github', { exact: true }))
    .toBeVisible();
  await expect
    .element(link)
    .toHaveAttribute('href', 'https://example.com/login');
  await expect.element(link).toHaveAttribute('target', '_blank');
  await expect.element(link).toHaveAttribute('rel', 'noopener');
  expect(screen.getByRole('button', { name: 'Send' }).elements()).toEqual([]);
  link.element().addEventListener('click', (event) => event.preventDefault());
  await link.click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [`/conversations/${A}/interactions/e2`, 'POST', { action: 'accept' }],
    ]),
  );
});

test('shows how a form was settled', async () => {
  const screen = await renderChat(A);
  coreReplied(
    A,
    { ...FORM, state: 'accepted' },
    { ...SIGN_IN, id: 'e3', state: 'declined' },
    { ...SIGN_IN, id: 'e4', state: 'cancelled', url: undefined },
  );
  await expect.element(screen.getByText('Sent to Agent')).toBeVisible();
  await expect.element(screen.getByText('Declined')).toBeVisible();
  await expect.element(screen.getByText('Cancelled')).toBeVisible();
  await expect
    .element(screen.getByRole('textbox', { name: 'Repository' }))
    .toHaveAttribute('readonly');
  expect(screen.getByRole('link').elements()).toEqual([]);
});

test('marks where the conversation was compacted, with its summary on demand', async () => {
  const screen = await renderChat(A);
  coreReplied(
    A,
    { type: 'compaction', id: 'c1', status: 'in_progress', summary: '' },
    { type: 'compaction', id: 'c2', status: 'failed', summary: '' },
    { type: 'compaction', id: 'c3', status: 'cancelled', summary: '' },
  );
  await expect
    .element(screen.getByText('Compacting conversation…'))
    .toBeVisible();
  await expect.element(screen.getByText('Compaction failed')).toBeVisible();
  await expect.element(screen.getByText('Compaction cancelled')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Summary' }).elements()).toEqual(
    [],
  );
  coreReplied(A, {
    type: 'compaction',
    id: 'c1',
    status: 'completed',
    summary: 'We **talked** about tests.',
  });
  await expect
    .element(screen.getByText('Conversation compacted'))
    .toBeVisible();
  const talked = screen.getByText('talked', { exact: true });
  await expect.element(talked).not.toBeInTheDocument();
  await screen.getByRole('button', { name: 'Summary' }).click();
  await expect.element(talked).toBeVisible();
});
