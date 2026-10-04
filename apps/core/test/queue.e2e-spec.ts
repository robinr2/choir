import { randomUUID } from 'node:crypto';
import type { ConversationState } from '../src/conversations/conversation-state.js';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

function queued({ queue }: ConversationState): string[] {
  return queue.map(({ text }) => text);
}

function lastTexts({ messages }: ConversationState): string[] {
  return messages.map(({ parts }) =>
    parts.map((part) => ('text' in part ? part.text : '')).join(''),
  );
}

async function running(text: string): Promise<void> {
  const { conversation } = testApp;
  void conversation.say(text);
  await conversation.until(({ status }) => status.state === 'working');
}

it('queues messages while a turn runs, sends them one by one and drops removed ones', async () => {
  const { conversation } = testApp;
  await running('stream-sleep 1500 first');
  const second = Promise.resolve(
    conversation.post('user-turns', {
      text: 'echo second',
      images: [{ data: 'aGk=', mimeType: 'image/png' }],
    }),
  );
  void conversation.say('echo third');
  const state = await conversation.until((seen) => seen.queue.length === 2);
  expect(state.queue).toEqual([
    { id: expect.any(String), text: 'echo second', images: 1 },
    { id: expect.any(String), text: 'echo third', images: 0 },
  ]);
  await conversation.send('delete', `queue/${state.queue[1]?.id}`).expect(204);
  const unknown = randomUUID();
  const missing = await conversation
    .send('delete', `queue/${unknown}`)
    .expect(404);
  expect(missing.body.message).toBe(`There is no queued message ${unknown}`);
  expect((await second).text).toContain('data: {"text":"second"}');
  expect(await conversation.userTexts()).toEqual([
    'stream-sleep 1500 first',
    'echo second',
  ]);
  expect(queued(await conversation.state())).toEqual([]);
});

it('steers the running turn with a new message or with a queued one', async () => {
  const { conversation } = testApp;
  await conversation.post('steerings', { text: 'echo idle' }).expect(204);
  await conversation.waitForAnswer('idle');
  await running('stream-sleep 1500 working');
  await conversation.waitForAnswer('working');
  await conversation.post('steerings', { text: 'use pnpm' }).expect(204);
  void conversation.say('use yarn');
  const { queue } = await conversation.until((seen) => seen.queue.length === 1);
  await conversation.post(`queue/${queue[0]?.id}/steering`).expect(204);
  await conversation.post(`queue/${randomUUID()}/steering`).expect(404);
  const state = await conversation.until(
    (seen) => seen.status.state === 'idle',
  );
  expect(state.messages.map(({ role, steered }) => [role, steered])).toEqual([
    ['user', undefined],
    ['assistant', undefined],
    ['user', undefined],
    ['assistant', undefined],
    ['user', true],
    ['assistant', undefined],
    ['user', true],
    ['assistant', undefined],
  ]);
  expect(lastTexts(state).slice(-4)).toEqual([
    'use pnpm',
    'steered: use pnpm',
    'use yarn',
    'steered: use yarn',
  ]);
});

it('cancels the running turn and goes on with the queue', async () => {
  const { conversation } = testApp;
  await running('stream-sleep 20000 long');
  const next = conversation.say('echo next');
  await conversation.until((seen) => seen.queue.length === 1);
  await conversation.post('cancellation').expect(204);
  expect((await next).text).toContain('data: {"text":"next"}');
  await conversation.post('cancellation').expect(204);
});

it('sends the next message as soon as the turn only waits for background subagents', async () => {
  const { conversation } = testApp;
  await running('background-subagent helper');
  const state = await conversation.until((seen) =>
    lastTexts(seen).includes('helper started'),
  );
  expect(state.status.state).toBe('working');
  const started = Date.now();
  expect((await conversation.say('echo after')).text).toContain(
    'data: {"text":"after"}',
  );
  expect(Date.now() - started).toBeLessThan(4_000);
  const done = await conversation.until((seen) => seen.status.state === 'idle');
  expect(done.messages[1]?.parts[0]).toMatchObject({
    toolName: 'Agent',
    status: 'completed',
    result: 'helper finished',
  });
});

it('shows a failed turn until the next one', async () => {
  const { conversation } = testApp;
  await conversation.say('fail');
  await conversation.until(({ status }) => status.state === 'failed');
  await conversation.say('echo again');
  await conversation.until(({ status }) => status.state === 'idle');
});
