import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type {
  Question,
  QuestionItem,
  TranscriptPart,
} from '@/conversation/transcript';
import { A, fakeCore, toolCall } from '@/test/fake-core';
import {
  coreReplied,
  exploring,
  interactions,
  renderChat,
} from '@/test/render-chat';

const COLOR: QuestionItem = {
  id: 'question_0',
  header: 'Color',
  prompt: 'Which color?',
  options: [
    { id: 'red', label: 'Red', description: 'Warm' },
    { id: 'blue', label: 'Blue' },
  ],
  multiple: false,
  freeform: 'question_0_custom',
};

const SIZES: QuestionItem = {
  id: 'question_1',
  header: 'Sizes',
  prompt: 'Which sizes?',
  options: [
    { id: 's', label: 'Small' },
    { id: 'm', label: 'Medium' },
  ],
  multiple: true,
  freeform: null,
};

const ASKED: Question = { id: 'i2', questions: [COLOR, SIZES] };

function asked(question: Question): TranscriptPart {
  return toolCall('t1', 'AskUserQuestion', {}, { status: 'pending', question });
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('answers every question together once each has an answer', async () => {
  const screen = await renderChat(A);
  coreReplied(A, asked(ASKED));
  const send = screen.getByRole('button', { name: 'Send answers' });
  await expect.element(screen.getByText('Warm')).toBeVisible();
  await expect.element(send).toBeDisabled();
  await screen.getByRole('button', { name: /Blue/ }).click();
  const other = screen.getByRole('textbox', { name: 'Other answer to Color' });
  await expect.element(other).toHaveValue('');
  await other.fill('teal');
  await expect.element(other).toHaveValue('teal');
  await expect.element(send).toBeDisabled();
  await screen.getByRole('checkbox', { name: 'Small' }).click();
  await screen.getByRole('checkbox', { name: 'Medium' }).click();
  await screen.getByRole('button', { name: 'Confirm' }).click();
  await send.click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [
        `/conversations/${A}/interactions/i2`,
        'POST',
        {
          action: 'accept',
          content: {
            question_0: 'blue',
            question_0_custom: 'teal',
            question_1: ['s', 'm'],
          },
        },
      ],
    ]),
  );
});

test('declines the questions', async () => {
  const screen = await renderChat(A);
  coreReplied(A, asked({ id: 'i2', questions: [COLOR] }));
  await screen.getByRole('button', { name: 'Decline' }).click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [`/conversations/${A}/interactions/i2`, 'POST', { action: 'decline' }],
    ]),
  );
});

test('shows what was answered or that nothing was', async () => {
  const screen = await renderChat(A);
  coreReplied(
    A,
    asked({
      ...ASKED,
      answers: { question_0_custom: 'teal', question_1: ['m'] },
    }),
    toolCall(
      't2',
      'AskUserQuestion',
      {},
      {
        question: { id: 'i3', questions: [COLOR], resolution: 'cancelled' },
      },
    ),
  );
  await expect.element(screen.getByText('Other: teal')).toBeVisible();
  expect(screen.getByText('Nothing selected').elements()).toEqual([]);
  await expect.element(screen.getByText('Medium')).toBeVisible();
  expect(screen.getByText('Small').elements()).toEqual([]);
  expect(
    screen.getByRole('button', { name: 'Send answers' }).elements(),
  ).toEqual([]);
  await expect.element(screen.getByText('Answered')).toBeVisible();
  await expect.element(screen.getByText('Cancelled')).toBeVisible();
  coreReplied(A, asked({ ...ASKED, resolution: 'declined' }));
  await expect.element(screen.getByText('Declined')).toBeVisible();
  expect(screen.getByText('Which color?').elements()).toHaveLength(0);
});

test('answers questions a subagent asks in its transcript', async () => {
  const screen = await renderChat(A);
  coreReplied(A, exploring(asked({ id: 'i7', questions: [COLOR] })));
  await screen.getByRole('button', { name: /Explore/ }).click();
  await screen.getByRole('button', { name: /Red/ }).click();
  await screen.getByRole('button', { name: 'Send answers' }).click();
  await vi.waitFor(() =>
    expect(interactions()).toEqual([
      [
        `/conversations/${A}/interactions/i7`,
        'POST',
        { action: 'accept', content: { question_0: 'red' } },
      ],
    ]),
  );
});
