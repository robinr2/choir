import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AcpxRuntime } from 'acpx/runtime';
import request from 'supertest';
import { AgentService } from '../src/agent/agent.service.js';
import { EventStream } from './event-stream.js';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

it('starts a conversation in the default folder with the default profile', async () => {
  const setMode = vi.spyOn(AcpxRuntime.prototype, 'setMode');
  expect(await testApp.conversation.messages()).toEqual([]);
  expect(setMode).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ mode: 'bypassPermissions' }),
  );
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
  const agent = testApp.app.get(AgentService);
  const record = await agent.record(await agent.open(testApp.conversation.id));
  expect(record.acpx?.session_options?.env).toEqual({
    CHOIR_CONVERSATION_ID: testApp.conversation.id,
  });
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
      args: { filePath: notes },
      result: { content: 'buy milk' },
      isError: false,
    },
    { type: 'text', text: `read complete: ${notes}` },
  ]);
});

it('streams every change of the conversation', async () => {
  const { app, conversation } = testApp;
  const events = await EventStream.open(
    app,
    `/conversations/${conversation.id}/events`,
  );
  try {
    await events.until('data: {"messages":[]}\n\n');
    await conversation.say('echo hi');
    await events.until(
      '{"id":"m1","role":"assistant","parts":[{"type":"text","text":"hi"}]}',
    );
  } finally {
    events.close();
  }
});

it('resumes the session when the conversation is reopened', async () => {
  const setMode = vi.spyOn(AcpxRuntime.prototype, 'setMode');
  await testApp.conversation.say('echo first');
  const reopened = await testApp.reopen();
  await reopened.say('echo second');
  expect(await reopened.userTexts()).toEqual(['echo first', 'echo second']);
  expect(setMode).toHaveBeenCalledOnce();
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
