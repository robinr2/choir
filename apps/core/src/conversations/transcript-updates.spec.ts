import type { SessionUpdate } from '@agentclientprotocol/sdk';
import type { AgentUpdate } from '../agent/agent-updates.js';
import { toolCallPart } from './tool-call-part.js';
import type { TranscriptMessage } from './transcript.js';
import { withAgentUpdate, withinSession } from './transcript-updates.js';

const ROOT = 'root';

function on(sessionId: string, update: AgentUpdate['update']): AgentUpdate {
  return { sessionId, update };
}

function says(text: string): SessionUpdate {
  return {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
  };
}

function applied(updates: AgentUpdate[], at = 10): TranscriptMessage[] {
  return updates.reduce<TranscriptMessage[]>(
    (messages, update) => withAgentUpdate(messages, ROOT, update, at),
    [],
  );
}

function spawned(id: string, name: string) {
  return {
    sessionUpdate: 'subagent_spawned',
    subagentSessionId: id,
    name,
    task: `Do ${name}`,
  } as const;
}

function finished(id: string, state: string) {
  return {
    sessionUpdate: 'subagent_state_update',
    subagentSessionId: id,
    state,
  } as const;
}

function added(session: TranscriptMessage[]): TranscriptMessage[] {
  return [...session, { id: 'x', role: 'user', parts: [] }];
}

it('turns the chunks of the user and the agent into messages', () => {
  expect(
    applied([
      on(ROOT, {
        sessionUpdate: 'user_message_chunk',
        content: { type: 'text', text: 'Hi' },
      }),
      on(ROOT, {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: 'hm' },
      }),
      on(ROOT, {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'image', data: 'x', mimeType: 'image/png' },
      }),
      on(ROOT, says('Hel')),
      on(ROOT, says('lo')),
      on(ROOT, {
        sessionUpdate: 'available_commands_update',
        availableCommands: [],
      }),
    ]),
  ).toEqual([
    { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
    {
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'hm' },
        { type: 'text', text: 'Hello' },
      ],
    },
  ]);
});

it('follows tool calls wherever they are and ignores updates of unknown ones', () => {
  const messages = applied([
    on(ROOT, { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Read' }),
    on(ROOT, {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'nope',
      status: 'completed',
    }),
    on(ROOT, {
      sessionUpdate: 'user_message_chunk',
      content: { type: 'text', text: 'Go' },
    }),
    on(ROOT, {
      sessionUpdate: 'tool_call',
      toolCallId: 't1',
      kind: 'read',
      title: 'Read a',
    }),
    on(ROOT, {
      sessionUpdate: 'tool_call_update',
      toolCallId: 't1',
      status: 'completed',
    }),
  ]);
  expect(messages).toEqual([
    {
      id: 'm0',
      role: 'assistant',
      parts: [
        {
          ...toolCallPart('t1', 10),
          toolName: 'Read a',
          kind: 'read',
          status: 'completed',
          isError: false,
          timing: { startedAt: 10, completedAt: 10 },
        },
      ],
    },
    { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Go' }] },
  ]);
});

it('starts a compaction it first hears of through its summary', () => {
  const [message] = applied([
    on(ROOT, {
      sessionUpdate: 'compaction_summary_chunk',
      compactionId: 'c9',
      content: { type: 'text', text: 'Early' },
    }),
  ]);
  expect(message?.parts).toEqual([
    { type: 'compaction', id: 'c9', status: 'in_progress', summary: 'Early' },
  ]);
});

it('shows a compaction with its summary as it arrives', () => {
  const chunk = (compactionId: string, text: string): AgentUpdate =>
    on(ROOT, {
      sessionUpdate: 'compaction_summary_chunk',
      compactionId,
      content: { type: 'text', text },
    });
  const [message] = applied([
    on(ROOT, {
      sessionUpdate: 'compaction_update',
      compactionId: 'c1',
      status: 'in_progress',
    }),
    chunk('c1', 'Short '),
    chunk('c1', 'summary'),
    on(ROOT, {
      sessionUpdate: 'compaction_update',
      compactionId: 'c1',
      status: 'completed',
    }),
    chunk('c2', 'Started late'),
    on(ROOT, {
      sessionUpdate: 'compaction_update',
      compactionId: 'c3',
      status: 'completed',
      summary: [
        { type: 'text', text: 'Replayed ' },
        { type: 'text', text: 'summary' },
      ],
    }),
    on(ROOT, {
      sessionUpdate: 'compaction_update',
      compactionId: 'c2',
      status: 'failed',
    }),
  ]);
  expect(message?.parts).toEqual([
    {
      type: 'compaction',
      id: 'c1',
      status: 'completed',
      summary: 'Short summary',
    },
    { type: 'compaction', id: 'c2', status: 'failed', summary: 'Started late' },
    {
      type: 'compaction',
      id: 'c3',
      status: 'completed',
      summary: 'Replayed summary',
    },
  ]);
});

it('nests the transcripts of subagents in their task and ends it with their last text', () => {
  const messages = applied([
    on(ROOT, spawned('a', 'outer')),
    on(ROOT, spawned('a', 'again')),
    on('a', {
      sessionUpdate: 'user_message_chunk',
      content: { type: 'text', text: 'Do outer' },
    }),
    on('a', says('working')),
    on('a', spawned('b', 'inner')),
    on('b', says('inner done')),
    on('a', finished('b', 'cancelled')),
    on('a', says('outer done')),
    on('stranger', says('ignored')),
    on(ROOT, finished('a', 'completed')),
    on(ROOT, finished('unknown', 'completed')),
  ]);
  const inner = {
    ...toolCallPart('b', 10),
    toolName: 'Agent',
    kind: 'think',
    args: { description: 'inner', prompt: 'Do inner' },
    status: 'failed',
    isError: true,
    result: 'inner done',
    timing: { startedAt: 10, completedAt: 10 },
    messages: [
      {
        id: 'm0',
        role: 'assistant',
        parts: [{ type: 'text', text: 'inner done' }],
      },
    ],
  };
  expect(messages).toEqual([
    {
      id: 'm0',
      role: 'assistant',
      parts: [
        {
          ...toolCallPart('a', 10),
          toolName: 'Agent',
          kind: 'think',
          args: { description: 'outer', prompt: 'Do outer' },
          status: 'completed',
          isError: false,
          result: 'outer done',
          timing: { startedAt: 10, completedAt: 10 },
          messages: [
            {
              id: 'm0',
              role: 'assistant',
              parts: [
                { type: 'text', text: 'working' },
                inner,
                { type: 'text', text: 'outer done' },
              ],
            },
          ],
        },
      ],
    },
  ]);
});

it('ends a subagent with its last text even when tools followed it', () => {
  const [message] = applied([
    on(ROOT, spawned('a', 'busy')),
    on('a', says('found it')),
    on('a', { sessionUpdate: 'tool_call', toolCallId: 't9', title: 'Read' }),
    on(ROOT, finished('a', 'completed')),
  ]);
  expect(message?.parts[0]).toMatchObject({ result: 'found it' });
});

it('ends a subagent without a transcript without a result', () => {
  const [message] = applied([
    on(ROOT, spawned('a', 'quiet')),
    on(ROOT, finished('a', 'disconnected')),
  ]);
  expect(message?.parts[0]).toMatchObject({
    status: 'failed',
    isError: true,
    messages: [],
  });
  expect(message?.parts[0]).not.toHaveProperty('result');
});

it('changes the messages of the root session or of a subagent', () => {
  const messages = applied([
    on(ROOT, spawned('a', 'sub')),
    on(ROOT, says('after')),
  ]);
  expect(
    withinSession(messages, { root: ROOT, sessionId: ROOT }, added),
  ).toEqual(added(messages));
  const [nested] = withinSession(
    messages,
    { root: ROOT, sessionId: 'a' },
    added,
  );
  expect(nested?.parts[0]).toMatchObject({
    messages: [{ id: 'x', role: 'user', parts: [] }],
  });
  expect(nested?.parts[1]).toEqual({ type: 'text', text: 'after' });
});
