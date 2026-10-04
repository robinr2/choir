import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  type AgentContext,
  methods,
  type NewSessionRequest,
  type PermissionOptionKind,
  type RequestPermissionRequest,
  type SessionUpdate,
} from '@agentclientprotocol/sdk';

export type Session = {
  updates: SessionUpdate[];
  setup: NewSessionRequest;
  mode?: string;
  running?: AbortController;
};

type Emit = (update: SessionUpdate) => Promise<void>;

export type Turn = {
  sessionId: string;
  session: Session;
  client: AgentContext;
  emit: Emit;
  signal: AbortSignal;
};

type Command = (words: string[], turn: Turn) => Promise<void>;

const PERMISSION_KINDS: PermissionOptionKind[] = [
  'allow_once',
  'allow_always',
  'reject_once',
  'reject_always',
];

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
  const request: RequestPermissionRequest = {
    sessionId,
    toolCall: { toolCallId: randomUUID() },
    options: kinds.map((kind) => ({
      optionId: `${kind}-option`,
      name: kind,
      kind,
    })),
  };
  const { outcome } = await client.request(
    methods.client.session.requestPermission,
    request,
  );
  await emit(said(JSON.stringify(outcome)));
}

export const commands: Record<string, Command> = {
  echo: (words, { emit }) => emit(said(words.join(' '))),
  env: ([name = ''], { emit }) => emit(said(process.env[name] ?? '')),
  'read-tool': (words, { emit }) => readTool(words.join(' '), emit),
  'stream-sleep': async ([ms, ...words], { emit, signal }) => {
    await emit(said(words.join(' ')));
    await sleep(Number(ms), undefined, { signal });
  },
  'ask-permission': askPermission,
  mode: (_, { session, emit }) => emit(said(session.mode ?? 'default')),
  'session-setup': (_, { session, emit }) =>
    emit(said(JSON.stringify(session.setup))),
  fail: async () => {
    throw new Error('The prompt failed');
  },
};
