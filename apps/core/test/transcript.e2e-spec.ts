import path from 'node:path';
import request from 'supertest';
import type { TranscriptMessage } from '../src/conversations/transcript.js';
import { EventStream } from './event-stream.js';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

const IMAGE = { data: 'aGk=', mimeType: 'image/png' };

function untimed(messages: TranscriptMessage[]): unknown {
  return JSON.parse(
    JSON.stringify(messages, (key, value) =>
      key === 'timing' ? undefined : value,
    ),
  );
}

it('shows thoughts, edits, failed tools, compactions and images, and replays them the same way', async () => {
  const { conversation } = testApp;
  const notes = path.join(testApp.dataDir, 'notes.md');
  await conversation.say('think hard');
  await conversation.say(`edit-tool ${notes}`);
  await conversation.say('fail-tool');
  await conversation.say('compact');
  await conversation.post('user-turns', { text: 'echo look', images: [IMAGE] });
  const messages = await conversation.messages();
  expect(messages.map(({ parts }) => parts)).toEqual([
    [{ type: 'text', text: 'think hard' }],
    [
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text: 'hard' },
    ],
    [{ type: 'text', text: `edit-tool ${notes}` }],
    [
      {
        type: 'tool-call',
        toolCallId: expect.any(String),
        toolName: 'Edit notes',
        kind: 'edit',
        args: { file_path: notes },
        result: 'edited',
        isError: false,
        status: 'completed',
        diffs: [{ path: notes, oldText: 'old', newText: 'new' }],
        locations: [{ path: notes, line: 3 }],
        timing: {
          startedAt: expect.any(Number),
          completedAt: expect.any(Number),
        },
      },
    ],
    [{ type: 'text', text: 'fail-tool' }],
    [
      expect.objectContaining({
        toolName: 'Bash',
        status: 'failed',
        isError: true,
        result: 'boom',
      }),
    ],
    [{ type: 'text', text: 'compact' }],
    [
      {
        type: 'compaction',
        id: expect.any(String),
        status: 'completed',
        summary: 'Short summary',
      },
    ],
    [
      { type: 'text', text: 'echo look' },
      { type: 'image', image: 'data:image/png;base64,aGk=' },
    ],
    [{ type: 'text', text: 'look' }],
  ]);
  const reopened = await testApp.reopen();
  expect(untimed(await reopened.messages())).toEqual(untimed(messages));
});

function subagent(name: string, messages: unknown[]) {
  return {
    type: 'tool-call',
    toolCallId: expect.any(String),
    toolName: 'Agent',
    kind: 'think',
    args: { description: name, prompt: `Do ${name}` },
    status: 'completed',
    isError: false,
    result: `${name} done`,
    diffs: [],
    locations: [],
    timing: { startedAt: expect.any(Number), completedAt: expect.any(Number) },
    messages,
  };
}

function reply(id: string, parts: unknown[]) {
  return {
    id,
    role: 'assistant',
    parts,
  };
}

it('nests the transcripts of subagents in their task and replays them', async () => {
  const { conversation } = testApp;
  await conversation.say('nested-subagent');
  const [, answer] = await conversation.messages();
  expect(answer?.parts).toEqual([
    subagent('outer', [
      reply('m0', [
        subagent('inner', [
          reply('m0', [{ type: 'text', text: 'inner done' }]),
        ]),
        { type: 'text', text: 'outer done' },
      ]),
    ]),
  ]);
  const reopened = await testApp.reopen();
  expect(untimed(await reopened.messages())).toEqual(
    untimed(await conversation.messages()),
  );
});

it('follows the plan, title, usage, commands and settings of the session', async () => {
  const { conversation } = testApp;
  await conversation.say('plan');
  await conversation.say('title Notes work');
  await conversation.say('usage');
  const state = await conversation.until(({ settings }) => settings !== null);
  expect(state.plan).toEqual([
    { content: 'Read', status: 'completed' },
    { content: 'Write', status: 'in_progress' },
  ]);
  expect(state.session).toEqual({
    id: expect.any(String),
    title: 'Notes work',
    cwd: path.join(testApp.dataDir, 'default'),
  });
  expect(state.usage).toEqual({ used: 1200, size: 200000, cost: 0.25 });
  expect(state.commands.map(({ name, hint }) => [name, hint])).toEqual([
    ['compact', null],
    ['review', 'pr'],
    ['branch', '[name]'],
    ['fork', '[prompt]'],
    ['subtask', '<task>'],
    ['resume', '[session id]'],
  ]);
  expect(state.settings).toMatchObject({
    model: 'default',
    effort: 'default',
    mode: 'bypassPermissions',
  });
  expect(state.settings?.models.map(({ value }) => value)).toEqual([
    'default',
    'opus',
    'haiku',
  ]);
  expect(state.status).toEqual({ state: 'idle', since: expect.any(Number) });
});

it('changes the model, effort and mode of a running session', async () => {
  const { conversation } = testApp;
  await conversation.state();
  await conversation
    .send('put', 'settings', { model: 'opus', effort: 'max', mode: 'plan' })
    .expect(204);
  const state = await conversation.until(({ settings }) => settings !== null);
  expect(state.settings).toMatchObject({
    model: 'opus',
    effort: 'max',
    mode: 'plan',
  });
  await conversation.send('put', 'settings', {}).expect(400);
  await conversation.send('put', 'settings', { model: ' ' }).expect(400);
});

it('keeps the latest rate limits of every session', async () => {
  const events = await EventStream.page(testApp.app);
  try {
    await events.until('event: rate-limits\n');
    await events.until('data: {"windows":[]}');
    await testApp.conversation.say('usage');
    const { body } = await request(testApp.app.getHttpServer())
      .get('/rate-limits')
      .expect(200);
    expect(body).toEqual({
      windows: [
        {
          window: 'five_hour',
          utilization: 0.28,
          resetsAt: 1791152400,
          status: 'allowed',
        },
        {
          window: 'seven_day',
          utilization: 0.43,
          resetsAt: 1791648000,
          status: 'allowed',
        },
      ],
    });
    await events.until('"window":"seven_day"');
  } finally {
    events.close();
  }
});
