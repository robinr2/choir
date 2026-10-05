import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  type AgentContext,
  methods,
  type PermissionOptionKind,
  type RequestPermissionRequest,
  type SessionUpdate,
} from '@agentclientprotocol/sdk';
import { configOptions } from './mock-agent-config.js';
import type { Recorded, Session } from './mock-agent-sessions.js';

type Emit = (update: SessionUpdate) => Promise<void>;

export type Turn = {
  sessionId: string;
  session: Session;
  client: AgentContext;
  emit: Emit;
  record: (notification: Recorded) => Promise<void>;
  signal: AbortSignal;
  capabilities: unknown;
};

type Command = (words: string[], turn: Turn) => Promise<void>;

const PERMISSION_KINDS: PermissionOptionKind[] = [
  'allow_once',
  'allow_always',
  'reject_once',
  'reject_always',
];

const WITHDRAWAL = 200;

export function said(text: string): SessionUpdate {
  return {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
  };
}

async function readTool(filePath: string, emit: Emit): Promise<void> {
  const toolCallId = randomUUID();
  await emit({
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'Read',
    kind: 'read',
    status: 'pending',
    rawInput: { filePath },
  });
  const content = await readFile(filePath, 'utf8');
  await emit({
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    rawOutput: { content },
  });
  await emit(said(`read complete: ${filePath}`));
}

async function askPermission(
  names: string[],
  { sessionId, client, emit }: Turn,
): Promise<void> {
  const kinds = PERMISSION_KINDS.filter((kind) => names.includes(kind));
  const toolCallId = randomUUID();
  const toolCall = {
    toolCallId,
    title: 'rm -rf build',
    kind: 'execute' as const,
  };
  await emit({ sessionUpdate: 'tool_call', ...toolCall, status: 'pending' });
  const request: RequestPermissionRequest = {
    sessionId,
    toolCall: { ...toolCall, rawInput: { command: 'rm -rf build' } },
    options: kinds.map((kind) => ({
      optionId: `${kind}-option`,
      name: kind,
      kind,
    })),
  };
  const withdrawal = names.includes('withdraw') ? WITHDRAWAL : undefined;
  const { outcome } = await client.request(
    methods.client.session.requestPermission,
    request,
    { cancellationSignal: withdrawal && AbortSignal.timeout(withdrawal) },
  );
  await emit(said(JSON.stringify(outcome)));
}

const FORM = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const, title: 'Name' },
    color: { type: 'string' as const, enum: ['red', 'blue'] },
    ok: { type: 'boolean' as const },
  },
  required: ['name'],
};

function elicitation(sessionId: string, mode: string, elicitationId: string) {
  if (mode !== 'url') {
    return { sessionId, mode: 'form', message: 'Pick', requestedSchema: FORM };
  }
  const url = 'https://example.com';
  return { sessionId, mode: 'url', elicitationId, url, message: 'Sign in' };
}

async function elicit(
  [mode = 'form']: string[],
  { sessionId, client, emit }: Turn,
): Promise<void> {
  const elicitationId = randomUUID();
  const response = await client.request(
    methods.client.elicitation.create,
    elicitation(sessionId, mode, elicitationId),
  );
  if (mode === 'url') {
    await client.notify(methods.client.elicitation.complete, { elicitationId });
  }
  await emit(said(JSON.stringify(response)));
}

async function subagent(
  words: string[],
  { sessionId, client, record, emit }: Turn,
) {
  const subagentSessionId = randomUUID();
  const name = words.join(' ');
  await record({
    sessionId,
    update: {
      sessionUpdate: 'subagent_spawned',
      subagentSessionId,
      name,
      task: `Do ${name}`,
    },
  });
  await record({ sessionId: subagentSessionId, update: said(`${name} done`) });
  await record({
    sessionId,
    update: {
      sessionUpdate: 'subagent_state_update',
      subagentSessionId,
      state: 'completed',
    },
  });
  await client.notify(methods.client.session.update, {
    sessionId: randomUUID(),
    update: said('stranger'),
  });
  await emit(said(`${name} reported`));
}

async function pushConfig(_: string[], { session, emit }: Turn): Promise<void> {
  session.config = { ...session.config, mode: 'plan', model: 'opus' };
  await emit({
    sessionUpdate: 'config_option_update',
    configOptions: configOptions(session.config),
  });
  session.config = { ...session.config, mode: 'default' };
  await emit({
    sessionUpdate: 'current_mode_update',
    currentModeId: 'default',
  });
}

export const commands: Record<string, Command> = {
  echo: (words, { emit }) => emit(said(words.join(' '))),
  env: ([name = ''], { emit }) => emit(said(process.env[name] ?? '')),
  cwd: (_, { emit }) => emit(said(process.cwd())),
  'read-tool': (words, { emit }) => readTool(words.join(' '), emit),
  'stream-sleep': async ([ms, ...words], { emit, signal }) => {
    await emit(said(words.join(' ')));
    await sleep(Number(ms), undefined, { signal });
  },
  'ask-permission': askPermission,
  elicit,
  subagent,
  'push-config': pushConfig,
  mode: (_, { session, emit }) => emit(said(session.config.mode)),
  config: (_, { session, emit }) => emit(said(JSON.stringify(session.config))),
  'session-setup': (_, { session, emit }) =>
    emit(said(JSON.stringify(session.setup))),
  'prompt-blocks': (_, { session, emit }) =>
    emit(said(JSON.stringify(session.prompt))),
  capabilities: (_, { capabilities, emit }) =>
    emit(said(JSON.stringify(capabilities))),
  fail: async () => {
    throw new Error('The prompt failed');
  },
};
