import { randomUUID } from 'node:crypto';
import type { ConversationState } from '../src/conversations/conversation-state.js';
import type { TranscriptPart } from '../src/conversations/transcript.js';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

function parts({ messages }: ConversationState): TranscriptPart[] {
  return messages.flatMap(({ role, parts: shown }) =>
    role === 'assistant' ? shown : [],
  );
}

async function waiting(text: string) {
  const { conversation } = testApp;
  const answer = conversation.say(text);
  const state = await conversation.until(
    ({ status }) => status.state === 'waiting',
  );
  return { answer, state };
}

it('asks the user to approve a tool call and answers with the chosen option', async () => {
  const { conversation } = testApp;
  const { answer, state } = await waiting(
    'ask-permission allow_once reject_once',
  );
  const part = parts(state).find(({ type }) => type === 'tool-call');
  expect(part).toMatchObject({
    toolName: 'rm -rf build',
    kind: 'execute',
    args: { command: 'rm -rf build' },
    approval: {
      id: expect.any(String),
      prompt: 'rm -rf build',
      options: [
        { id: 'allow_once-option', kind: 'allow-once', label: 'allow_once' },
        { id: 'reject_once-option', kind: 'reject-once', label: 'reject_once' },
      ],
    },
  });
  const id = part?.type === 'tool-call' ? part.approval?.id : undefined;
  const path = `interactions/${id}`;
  const unfit = await conversation.post(path, { optionId: 'nope' }).expect(400);
  expect(unfit.body.message).toBe('The answer does not fit the question');
  await conversation.post(path, { optionId: 'nope', action: 'x' }).expect(400);
  await conversation.post(path, { optionId: 'reject_once-option' }).expect(204);
  const again = await conversation
    .post(path, { optionId: 'reject_once-option' })
    .expect(409);
  expect(again.body.message).toBe('It is answered already');
  const unknown = await conversation
    .post(`interactions/${randomUUID()}`, { action: 'cancel' })
    .expect(404);
  expect(unknown.body.message).toBe('There is no such question');
  expect((await answer).text).toContain('reject_once-option');
  const settled = parts(await conversation.state())[0];
  expect(settled).toMatchObject({
    approval: { approved: false, optionId: 'reject_once-option' },
  });
});

it('asks the questions of the agent and answers them', async () => {
  const { conversation } = testApp;
  const { answer, state } = await waiting('ask-question');
  const [part] = parts(state);
  expect(part).toMatchObject({
    type: 'tool-call',
    toolName: 'Which database?',
    question: {
      id: expect.any(String),
      questions: [
        {
          id: 'question_0',
          header: 'Database',
          prompt: 'Which database?',
          options: [
            { id: 'Postgres', label: 'Postgres', description: 'Relational' },
            { id: 'Redis', label: 'Redis' },
          ],
          multiple: false,
          freeform: 'question_0_custom',
        },
      ],
    },
  });
  const id = part?.type === 'tool-call' ? part.question?.id : undefined;
  const content = { question_0: 'Redis', question_0_custom: 'fast' };
  await conversation
    .post(`interactions/${id}`, { action: 'accept', content })
    .expect(204);
  expect((await answer).text).toContain('Redis');
  const done = await conversation.until(
    ({ status }) => status.state === 'idle',
  );
  expect(parts(done)[0]).toMatchObject({ question: { answers: content } });
});

it('shows the forms and links of the agent and how the user answered them', async () => {
  const { conversation } = testApp;
  const form = await waiting('elicit form');
  const [part] = parts(form.state);
  expect(part).toEqual({
    type: 'elicitation',
    id: expect.any(String),
    server: null,
    message: 'Pick',
    mode: 'form',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      {
        name: 'color',
        label: 'color',
        kind: 'choice',
        options: ['red', 'blue'],
        required: false,
      },
      { name: 'ok', label: 'ok', kind: 'toggle', required: false },
    ],
    state: 'request',
  });
  await conversation
    .post(`interactions/${part?.type === 'elicitation' && part.id}`, {
      action: 'decline',
    })
    .expect(204);
  await form.answer;
  const link = await waiting('elicit url');
  const asked = parts(link.state).at(-1);
  expect(asked).toMatchObject({ mode: 'url', url: 'https://example.com' });
  await conversation.post('cancellation').expect(204);
  await link.answer;
  const done = await conversation.until(
    ({ status }) => status.state === 'idle',
  );
  expect(
    parts(done).flatMap((seen) => ('state' in seen ? [seen.state] : [])),
  ).toEqual(['declined', 'cancelled']);
});
