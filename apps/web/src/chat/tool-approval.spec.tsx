import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Approval } from '@/conversation/transcript';
import { A, fakeCore, toolCall } from '@/test/fake-core';
import {
  coreReplied,
  exploring,
  interactions,
  renderChat,
} from '@/test/render-chat';

const PLAN_OPTIONS: Approval['options'] = [
  {
    id: 'exit-plan-auto',
    kind: 'allow-always',
    label: 'Yes, and use auto mode',
  },
  {
    id: 'exit-plan-default',
    kind: 'allow-once',
    label: 'Yes, manually approve edits',
  },
  { id: 'reject', kind: 'reject-once', label: 'No, keep planning' },
];

const BASH_OPTIONS: Approval['options'] = [
  { id: 'allow', kind: 'allow-once', label: 'Allow' },
  { id: 'reject', kind: 'reject-once', label: 'Reject' },
];

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('offers every option the agent sent and answers with the chosen one', async () => {
  const screen = await renderChat(A);
  coreReplied(
    A,
    toolCall(
      't1',
      'Approve Plan',
      { plan: '# The plan\n\n1. **Read** the code' },
      {
        status: 'pending',
        approval: { id: 'i1', prompt: 'Ready to code?', options: PLAN_OPTIONS },
      },
    ),
  );
  await expect.element(screen.getByText('Ready to code?')).toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'The plan' }))
    .toBeVisible();
  await expect.element(screen.getByText('Read', { exact: true })).toBeVisible();
  const option = (name: string) => screen.getByRole('button', { name });
  await expect.element(option('Yes, and use auto mode')).toBeVisible();
  await expect.element(option('No, keep planning')).toBeVisible();
  await screen
    .getByRole('button', { name: 'Yes, manually approve edits' })
    .click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [
        `/conversations/${A}/interactions/i1`,
        'POST',
        { optionId: 'exit-plan-default' },
      ],
    ]),
  );
});

test('shows the command and the edits an approval is about', async () => {
  const screen = await renderChat(A);
  coreReplied(
    A,
    toolCall(
      't1',
      'Clean up',
      { command: 'rm -rf build' },
      {
        status: 'pending',
        approval: { id: 'i1', options: BASH_OPTIONS },
      },
    ),
    toolCall(
      't2',
      'Edit a.ts',
      {},
      {
        status: 'pending',
        kind: 'edit',
        approval: { id: 'i2', prompt: 'Edit a.ts', options: BASH_OPTIONS },
        diffs: [{ path: '/work/a.ts', oldText: 'a\n', newText: 'b\n' }],
        locations: [{ path: '/work/a.ts', line: 1 }],
      },
    ),
  );
  await expect
    .element(screen.getByText('rm -rf build', { exact: true }))
    .toBeVisible();
  await expect
    .element(screen.getByText('Waits for your approval').first())
    .toBeVisible();
  expect(screen.getByText('Waits for your approval').elements()).toHaveLength(
    2,
  );
  await expect
    .element(screen.getByRole('button', { name: 'a.ts:1' }))
    .toBeVisible();
  await expect.element(screen.getByText('+1', { exact: true })).toBeVisible();
});

test('keeps the receipt of answered approvals', async () => {
  const screen = await renderChat(A);
  const approval = { id: 'i1', options: BASH_OPTIONS };
  coreReplied(
    A,
    toolCall(
      't1',
      'Running',
      {},
      {
        status: 'in_progress',
        approval: { ...approval, approved: true, optionId: 'allow' },
      },
    ),
    toolCall(
      't2',
      'Ran',
      {},
      {
        approval: { ...approval, approved: true, optionId: 'allow' },
      },
    ),
    toolCall(
      't3',
      'Refused',
      {},
      {
        status: 'failed',
        approval: { ...approval, approved: false, optionId: 'reject' },
      },
    ),
    toolCall(
      't4',
      'Dropped',
      {},
      {
        status: 'failed',
        approval: { ...approval, resolution: 'cancelled' },
      },
    ),
    toolCall(
      't5',
      'Plain',
      {},
      {
        approval: { id: 'i5', options: [], approved: true },
      },
    ),
  );
  const card = (name: string) =>
    screen.getByRole('group', { name, exact: true });
  await expect.element(card('Running').getByText('Allow')).toBeVisible();
  await expect.element(card('Running').getByText('Approved')).toBeVisible();
  await expect
    .element(card('Ran').getByRole('status'))
    .toHaveTextContent('Allow');
  await expect
    .element(card('Refused').getByRole('status'))
    .toHaveTextContent('Reject');
  await expect.element(card('Refused').getByText('Not approved')).toBeVisible();
  await expect
    .element(card('Dropped').getByRole('status'))
    .toHaveTextContent('Cancelled');
  await expect
    .element(card('Plain').getByRole('status'))
    .toHaveTextContent('Finished');
  expect(screen.getByRole('button', { name: 'Allow' }).elements()).toEqual([]);
});

test('answers approvals of subagents in their transcript', async () => {
  const screen = await renderChat(A);
  coreReplied(
    A,
    exploring(
      toolCall(
        't1',
        'Write a.ts',
        {},
        {
          status: 'pending',
          approval: { id: 'i9', options: BASH_OPTIONS },
        },
      ),
    ),
  );
  await screen.getByRole('button', { name: /Explore/ }).click();
  await screen.getByRole('button', { name: 'Reject' }).click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [`/conversations/${A}/interactions/i9`, 'POST', { optionId: 'reject' }],
    ]),
  );
});
