import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { EventStream } from './event-stream.js';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

it('starts a conversation in the default folder with the default profile', async () => {
  const { conversation } = testApp;
  expect(await conversation.messages()).toEqual([]);
  const prompt = await readFile(
    path.join(
      testApp.dataDir,
      'profiles',
      'default',
      'default-voice-prompt.md',
    ),
    'utf8',
  );
  expect(prompt).toMatch(/^You are Claude, talking with the user out loud\./);
  expect((await conversation.say('mode')).text).toContain(
    'data: {"text":"bypassPermissions"}',
  );
  expect((await conversation.say('env CHOIR_CONVERSATION_ID')).text).toContain(
    `data: {"text":"${conversation.id}"}`,
  );
});

it('streams the answer and keeps the turn in the session', async () => {
  const response = await testApp.conversation.say('echo hello choir');
  expect(response.headers['content-type']).toMatch(/^text\/event-stream/);
  expect(response.text).toContain('data: {"text":"hello choir"}\n\n');
  expect(await testApp.conversation.messages()).toEqual([
    {
      id: 'm0',
      role: 'user',
      parts: [{ type: 'text', text: 'echo hello choir' }],
    },
    {
      id: 'm1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello choir' }],
    },
  ]);
});

it('shows the tool calls of a turn and their results', async () => {
  const notes = path.join(testApp.dataDir, 'default', 'notes.md');
  await writeFile(notes, 'buy milk');
  await testApp.conversation.say(`read-tool ${notes}`);
  const [, answer] = await testApp.conversation.messages();
  expect(answer?.parts).toEqual([
    {
      type: 'tool-call',
      toolCallId: expect.any(String),
      toolName: 'Read',
      kind: 'read',
      args: { filePath: notes },
      result: { content: 'buy milk' },
      isError: false,
      status: 'completed',
      diffs: [],
      locations: [],
      timing: {
        startedAt: expect.any(Number),
        completedAt: expect.any(Number),
      },
    },
    { type: 'text', text: `read complete: ${notes}` },
  ]);
});

it('streams every change of the conversations the page watches', async () => {
  const { app, conversation } = testApp;
  const events = await EventStream.page(app);
  try {
    const watched = `/events/${await events.connection()}/conversations/${conversation.id}`;
    const http = request(app.getHttpServer());
    await http.put(watched).expect(204);
    await events.until(`event: conversation\n`);
    await events.until(
      `data: {"id":"${conversation.id}","state":{"messages":[],`,
    );
    await conversation.post('queue', { text: 'echo hi' }).expect(202);
    await events.until(
      '{"id":"m1","role":"assistant","parts":[{"type":"text","text":"hi"}]}',
    );
    await http.delete(watched).expect(204);
    await conversation.say('echo again');
    await http.put(watched).expect(204);
    await events.until('"text":"again"');
    expect(events.text.split('"text":"again"')).toHaveLength(2);
  } finally {
    events.close();
  }
});

it('queues a chat message without waiting for its answer', async () => {
  const { conversation } = testApp;
  await conversation
    .post('queue', { text: 'stream-sleep 20000 slowly' })
    .expect(202);
  await conversation.until(({ status }) => status.state === 'working');
  const decision = await conversation.post('tool-calls').expect(200);
  expect(decision.body).toEqual({});
  await conversation.post('queue', { text: 'echo next' }).expect(202);
  await conversation.until(({ queue }) => queue.length === 1);
  await conversation.post('queue', { text: ' ' }).expect(400);
  await conversation.post('cancellation').expect(204);
  await conversation.waitForAnswer('next');
});

it('loads the session and its transcript from the agent when the conversation is reopened', async () => {
  await testApp.conversation.say('echo first');
  const reopened = await testApp.reopen();
  expect(await reopened.messages()).toEqual([
    { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'echo first' }] },
    { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'first' }] },
  ]);
  await reopened.say('echo second');
  expect(await reopened.userTexts()).toEqual(['echo first', 'echo second']);
  expect((await reopened.say('mode')).text).toContain(
    'data: {"text":"bypassPermissions"}',
  );
});

it('keeps every conversation in a session of its own', async () => {
  const other = testApp.talkTo(randomUUID());
  await testApp.conversation.say('echo first');
  await other.say('echo second');
  const reopened = await testApp.reopen();
  expect(await reopened.userTexts()).toEqual(['echo first']);
  expect(await testApp.talkTo(other.id).userTexts()).toEqual(['echo second']);
});

it('rejects requests it cannot understand', async () => {
  const { app, conversation } = testApp;
  await request(app.getHttpServer())
    .get('/conversations/not-a-uuid')
    .expect(400);
  await conversation.post('user-turns', { text: '  ' }).expect(400);
  await conversation
    .post('user-turns', { text: 'hi', early: 'yes' })
    .expect(400);
  await conversation.post('interruptions').expect(400);
});
