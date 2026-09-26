import { EventStream } from './event-stream.js';
import { TestApp } from './test-app.js';
import { callForJson } from './workspace-client.js';

const testApp = TestApp.use();

const HOOK_INPUT = { session_id: 's1', hook_event_name: 'UserPromptSubmit' };

async function voiceOn(): Promise<string> {
  const id = await testApp.workspace.firstAgent();
  await testApp.workspace.send('put', 'voice', { agentId: id }).expect(204);
  return id;
}

it('tells the voice app which agent it talks to', async () => {
  const id = await voiceOn();
  const events = await EventStream.open(testApp.app, '/voice/events');
  try {
    await events.until(`data: {"type":"agent","agentId":"${id}"}\n\n`);
    await testApp.workspace.send('put', 'voice', { agentId: null });
    await events.until('data: {"type":"agent","agentId":null}\n\n');
  } finally {
    events.close();
  }
});

it('turns voice off when the voice app disconnects', async () => {
  await voiceOn();
  const events = await EventStream.open(testApp.app, '/voice/events');
  await events.until('"type":"agent"');
  events.close();
  await vi.waitFor(async () =>
    expect((await testApp.workspace.view()).voiceAgentId).toBeNull(),
  );
});

it('makes a typed turn to the voice agent a voice turn and speaks its reply', async () => {
  const id = await voiceOn();
  const events = await EventStream.open(testApp.app, '/voice/events');
  const conversation = testApp.talkTo(id);
  try {
    const running = conversation.say('stream-sleep 1000 typed aloud');
    await conversation.waitForAnswer('typed aloud');
    await conversation
      .post('voice-turns', {
        ...HOOK_INPUT,
        prompt: 'stream-sleep 1000 typed aloud',
      })
      .expect(204);
    await events.until('data: {"type":"reply","text":"typed aloud"}\n\n');
    await running;
    await events.until('data: {"type":"reply-end"}\n\n');
  } finally {
    events.close();
  }
  const marks = (await conversation.messages()).map(
    ({ role, voice, spoken }) => [role, voice, spoken],
  );
  expect(marks).toEqual([
    ['user', undefined, undefined],
    ['assistant', undefined, true],
  ]);
});

it('speaks the reply to a message from another agent', async () => {
  const id = await voiceOn();
  const events = await EventStream.open(testApp.app, '/voice/events');
  const sender = await callForJson<{ id: string }>(
    await testApp.workspace.tools(id),
    'split_pane',
    { direction: 'vertical', name: 'helper' },
  );
  try {
    await callForJson(
      await testApp.workspace.tools(sender.id),
      'send_message',
      {
        agentId: id,
        text: 'echo all done',
      },
    );
    await events.until('"type":"reply","text":"unrecognized prompt:');
    await events.until('data: {"type":"reply-end"}\n\n');
  } finally {
    events.close();
  }
  const messages = await testApp.talkTo(id).messages();
  expect(
    messages.map(({ role, from, spoken }) => [role, from, spoken]),
  ).toEqual([
    ['user', { id: sender.id, name: 'helper' }, undefined],
    ['assistant', undefined, true],
  ]);
});

it('neither marks nor speaks turns while voice is off', async () => {
  const id = await testApp.workspace.firstAgent();
  const conversation = testApp.talkTo(id);
  const running = conversation.say('stream-sleep 1000 quietly');
  await conversation.waitForAnswer('quietly');
  await conversation
    .post('voice-turns', { ...HOOK_INPUT, prompt: 'stream-sleep 1000 quietly' })
    .expect(404);
  await running;
  expect((await conversation.messages()).map(({ spoken }) => spoken)).toEqual([
    undefined,
    undefined,
  ]);
});
