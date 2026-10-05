import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoreConversation } from '@/conversation/core-conversation';
import { fakeCore } from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { chatAnswersOf } from './chat-answers';

const answers = chatAnswersOf(new CoreConversation('c1'));

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('answers approvals with the chosen option', async () => {
  await answers.onRespondToToolApproval({
    approvalId: 'i1',
    approved: true,
    optionId: 'allow',
  });
  await expect(
    answers.onRespondToToolApproval({ approvalId: 'i1', approved: false }),
  ).rejects.toThrow(new Error('Choose one of the options the agent offers'));
  expect(requests()).toEqual([
    ['/conversations/c1/interactions/i1', 'POST', { optionId: 'allow' }],
  ]);
});

test('answers questions with what the user picked', async () => {
  for (const payload of [null, 'yes', { id: 'i2' }, { answer: {} }]) {
    expect(() =>
      answers.onResumeToolCall({ toolCallId: 't1', payload }),
    ).toThrow(new Error('Answer the questions with a question reply'));
  }
  answers.onResumeToolCall({
    toolCallId: 't1',
    payload: { id: 'i2', answer: { action: 'decline' } },
  });
  await vi.waitFor(() =>
    expect(requests()).toEqual([
      ['/conversations/c1/interactions/i2', 'POST', { action: 'decline' }],
    ]),
  );
});
