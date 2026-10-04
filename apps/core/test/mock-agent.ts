import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import {
  agent,
  type AgentContext,
  methods,
  type LoadSessionRequest,
  ndJsonStream,
  type NewSessionRequest,
  PROTOCOL_VERSION,
  type PromptRequest,
  type PromptResponse,
  type SessionUpdate,
  type SetSessionModeRequest,
  type StopReason,
} from '@agentclientprotocol/sdk';
import {
  commands,
  said,
  type Session,
  type Turn,
} from './mock-agent-commands.js';
import { readableStream } from '../src/agent/agent-process.js';

const STOP_REASONS: StopReason[] = [
  'end_turn',
  'max_tokens',
  'max_turn_requests',
  'refusal',
  'cancelled',
];

const { values: flags } = parseArgs({
  options: {
    sessions: { type: 'string', default: '' },
    'set-session-mode-fails': { type: 'boolean', default: false },
    'no-load-session': { type: 'boolean', default: false },
    respond: { type: 'string' },
    'stop-reason': { type: 'string', default: 'end_turn' },
  },
});

const sessions = new Map<string, Session>();

function file(sessionId: string): string {
  return path.join(flags.sessions, `${sessionId}.json`);
}

async function save(sessionId: string, session: Session): Promise<void> {
  await mkdir(flags.sessions, { recursive: true });
  const { setup, updates } = session;
  await writeFile(file(sessionId), JSON.stringify({ setup, updates }));
}

function sessionOf(sessionId: string): Session {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Unknown session ${sessionId}`);
  return session;
}

async function respond(text: string, turn: Turn): Promise<PromptResponse> {
  const [name = '', ...words] = (flags.respond ?? text).split(' ');
  const command = commands[name];
  if (command) await command(words, turn);
  else await turn.emit(said(`unrecognized prompt: ${text}`));
  const stopReason = STOP_REASONS.find(
    (reason) => reason === flags['stop-reason'],
  );
  return { stopReason: stopReason ?? 'end_turn' };
}

function emitter(
  sessionId: string,
  session: Session,
  client: AgentContext,
): Turn['emit'] {
  return async (update) => {
    session.updates.push(update);
    await save(sessionId, session);
    await client.notify(methods.client.session.update, { sessionId, update });
  };
}

async function prompt(
  { sessionId, prompt: blocks }: PromptRequest,
  client: AgentContext,
): Promise<PromptResponse> {
  const session = sessionOf(sessionId);
  const text = blocks
    .map((block) => ('text' in block ? block.text : ''))
    .join('');
  const running = new AbortController();
  session.running = running;
  session.updates.push({
    sessionUpdate: 'user_message_chunk',
    content: { type: 'text', text },
  });
  await save(sessionId, session);
  const turn = {
    sessionId,
    session,
    client,
    emit: emitter(sessionId, session, client),
    signal: running.signal,
  };
  return respond(text, turn).catch((error: unknown) => {
    if (running.signal.aborted) return { stopReason: 'cancelled' };
    throw error;
  });
}

async function load(
  { sessionId, ...setup }: LoadSessionRequest,
  client: AgentContext,
): Promise<object> {
  const saved: { updates: SessionUpdate[] } = JSON.parse(
    await readFile(file(sessionId), 'utf8'),
  );
  const { updates } = saved;
  sessions.set(sessionId, { updates, setup });
  await Promise.all(
    updates.map((update) =>
      client.notify(methods.client.session.update, { sessionId, update }),
    ),
  );
  return {};
}

async function create(
  setup: NewSessionRequest,
): Promise<{ sessionId: string }> {
  const sessionId = randomUUID();
  const session = { updates: [], setup };
  sessions.set(sessionId, session);
  await save(sessionId, session);
  return { sessionId };
}

function setMode({ sessionId, modeId }: SetSessionModeRequest): object {
  if (flags['set-session-mode-fails']) {
    throw new Error('The mode cannot be set');
  }
  sessionOf(sessionId).mode = modeId;
  return {};
}

agent({ name: 'mock-agent' })
  .onRequest(methods.agent.initialize, () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentCapabilities: { loadSession: !flags['no-load-session'] },
  }))
  .onRequest(methods.agent.session.new, ({ params }) => create(params))
  .onRequest(methods.agent.session.load, ({ params, client }) =>
    load(params, client),
  )
  .onRequest(methods.agent.session.setMode, ({ params }) => setMode(params))
  .onRequest(methods.agent.session.prompt, ({ params, client }) =>
    prompt(params, client),
  )
  .onNotification(methods.agent.session.cancel, ({ params }) => {
    sessions.get(params.sessionId)?.running?.abort();
  })
  .connect(
    ndJsonStream(Writable.toWeb(process.stdout), readableStream(process.stdin)),
  );
