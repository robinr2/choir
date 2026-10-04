import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { methods } from '@agentclientprotocol/sdk';
import { said, type Turn } from './mock-agent-commands.js';

type Command = (words: string[], turn: Turn) => Promise<void>;

const HOLD = 5_000;

const RATE_LIMIT = {
  status: 'allowed',
  rateLimitType: 'five_hour',
  utilization: 0.2,
  resetsAt: 1791152400,
};

async function editTool(
  [filePath = '']: string[],
  { emit }: Turn,
): Promise<void> {
  const toolCallId = randomUUID();
  await emit({
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'Edit notes',
    kind: 'edit',
    status: 'pending',
    rawInput: { file_path: filePath },
    content: [{ type: 'diff', path: filePath, oldText: 'old', newText: 'new' }],
    locations: [{ path: filePath }],
  });
  await emit({
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'in_progress',
  });
  await emit({
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    rawOutput: 'edited',
    locations: [{ path: filePath, line: 3 }],
  });
}

async function failTool(_: string[], { emit }: Turn): Promise<void> {
  const toolCallId = randomUUID();
  await emit({
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'Bash',
    kind: 'execute',
  });
  await emit({
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'failed',
    content: [{ type: 'content', content: { type: 'text', text: 'boom' } }],
  });
}

async function usage(_: string[], { emit }: Turn): Promise<void> {
  await emit({
    sessionUpdate: 'usage_update',
    used: 1000,
    size: 200000,
    _meta: { '_claude/rateLimit': RATE_LIMIT },
  });
  const unifiedWindows = {
    five_hour: { utilization: 0.28, resetsAt: 1791152400 },
    seven_day: { utilization: 0.43, resetsAt: 1791648000 },
  };
  await emit({
    sessionUpdate: 'usage_update',
    used: 1200,
    size: 200000,
    cost: { amount: 0.25, currency: 'USD' },
    _meta: { '_claude/rateLimit': { ...RATE_LIMIT, unifiedWindows } },
  });
}

async function compact(_: string[], { emit }: Turn): Promise<void> {
  const compactionId = randomUUID();
  await emit({
    sessionUpdate: 'compaction_update',
    compactionId,
    status: 'in_progress',
  });
  const text = { type: 'text' as const, text: 'Short summary' };
  await emit({
    sessionUpdate: 'compaction_summary_chunk',
    compactionId,
    content: text,
  });
  await emit({
    sessionUpdate: 'compaction_update',
    compactionId,
    status: 'completed',
  });
}

async function askQuestion(_: string[], { sessionId, client, emit }: Turn) {
  const toolCallId = randomUUID();
  await emit({
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'Which database?',
  });
  const response = await client.request(methods.client.elicitation.create, {
    sessionId,
    toolCallId,
    mode: 'form',
    message: 'Which database?',
    requestedSchema: {
      type: 'object',
      properties: {
        question_0: {
          type: 'string',
          title: 'Database',
          oneOf: [
            { const: 'Postgres', title: 'Postgres', description: 'Relational' },
            { const: 'Redis', title: 'Redis' },
          ],
        },
        question_0_custom: { type: 'string', title: 'Other' },
      },
    },
  });
  await emit(said(JSON.stringify(response)));
}

async function spawn(
  turn: Turn,
  parent: string,
  name: string,
): Promise<string> {
  const subagentSessionId = randomUUID();
  await turn.record({
    sessionId: parent,
    update: {
      sessionUpdate: 'subagent_spawned',
      subagentSessionId,
      name,
      task: `Do ${name}`,
    },
  });
  return subagentSessionId;
}

async function finish(turn: Turn, parent: string, child: string, text: string) {
  await turn.record({ sessionId: child, update: said(text) });
  await turn.record({
    sessionId: parent,
    update: {
      sessionUpdate: 'subagent_state_update',
      subagentSessionId: child,
      state: 'completed',
    },
  });
}

async function nestedSubagent(_: string[], turn: Turn): Promise<void> {
  const outer = await spawn(turn, turn.sessionId, 'outer');
  const inner = await spawn(turn, outer, 'inner');
  await finish(turn, outer, inner, 'inner done');
  await finish(turn, turn.sessionId, outer, 'outer done');
}

async function backgroundSubagent([name = 'helper']: string[], turn: Turn) {
  const child = await spawn(turn, turn.sessionId, name);
  await turn.emit(said(`${name} started`));
  const released = Promise.withResolvers<void>();
  turn.session.held = () => released.resolve();
  await turn.emit({
    sessionUpdate: 'usage_update',
    used: 10,
    size: 100,
    cost: { amount: 0.5, currency: 'USD' },
  });
  await Promise.race([released.promise, sleep(HOLD)]);
  turn.session.held = undefined;
  await finish(turn, turn.sessionId, child, `${name} finished`);
}

export const transcriptCommands: Record<string, Command> = {
  think: async (words, { emit }) => {
    await emit({
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'thinking' },
    });
    await emit(said(words.join(' ')));
  },
  'edit-tool': editTool,
  'fail-tool': failTool,
  plan: (_, { emit }) =>
    emit({
      sessionUpdate: 'plan',
      entries: [
        { content: 'Read', status: 'completed', priority: 'high' },
        { content: 'Write', status: 'in_progress', priority: 'medium' },
      ],
    }),
  usage,
  title: (words, { emit }) =>
    emit({ sessionUpdate: 'session_info_update', title: words.join(' ') }),
  compact,
  'ask-question': askQuestion,
  'nested-subagent': nestedSubagent,
  'background-subagent': backgroundSubagent,
};
