import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import {
  agent,
  type AgentContext,
  type ContentBlock,
  methods,
  type LoadSessionRequest,
  ndJsonStream,
  type NewSessionRequest,
  PROTOCOL_VERSION,
  type PromptRequest,
  type PromptResponse,
  type SetSessionConfigOptionRequest,
  type StopReason,
} from '@agentclientprotocol/sdk';
import { z } from 'zod';
import { commands, said, type Turn } from './mock-agent-commands.js';
import { type Config, configOptions, configured } from './mock-agent-config.js';
import { MockSessions } from './mock-agent-sessions.js';
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
    'set-config-fails': { type: 'boolean', default: false },
    'no-load-session': { type: 'boolean', default: false },
    'no-config-options': { type: 'boolean', default: false },
    respond: { type: 'string' },
    'stop-reason': { type: 'string', default: 'end_turn' },
  },
});

const steeringSchema = z
  .object({
    sessionId: z.string(),
    prompt: z.array(z.object({ text: z.string() })),
    _meta: z.object({
      steering: z.object({ idleBehavior: z.string() }),
    }),
  })
  .transform(({ _meta: meta, ...steering }) => ({
    ...steering,
    idleBehavior: meta.steering.idleBehavior,
  }));

const sessions = new MockSessions(flags.sessions);

let capabilities: unknown;

function offered(config: Config) {
  return flags['no-config-options']
    ? {}
    : { configOptions: configOptions(config) };
}

function text(blocks: ContentBlock[]): string {
  return blocks.map((block) => ('text' in block ? block.text : '')).join('');
}

async function respond(words: string, turn: Turn): Promise<PromptResponse> {
  const [name = '', ...rest] = (flags.respond ?? words).split(' ');
  const command = commands[name];
  if (command) await command(rest, turn);
  else await turn.emit(said(`unrecognized prompt: ${words}`));
  const stopReason = STOP_REASONS.find(
    (reason) => reason === flags['stop-reason'],
  );
  return { stopReason: stopReason ?? 'end_turn' };
}

function emitter(sessionId: string, client: AgentContext): Turn['emit'] {
  return async (update) => {
    sessions.get(sessionId).updates.push(update);
    await sessions.save(sessionId);
    await client.notify(methods.client.session.update, { sessionId, update });
  };
}

async function prompt(
  { sessionId, prompt: blocks }: PromptRequest,
  client: AgentContext,
): Promise<PromptResponse> {
  const session = sessions.get(sessionId);
  const running = new AbortController();
  Object.assign(session, { running, prompt: blocks });
  const words = text(blocks);
  session.updates.push({
    sessionUpdate: 'user_message_chunk',
    content: { type: 'text', text: words },
  });
  await sessions.save(sessionId);
  const { signal } = running;
  const emit = emitter(sessionId, client);
  const turn = { sessionId, session, client, emit, signal, capabilities };
  return respond(words, turn)
    .catch((error: unknown) => {
      if (running.signal.aborted) return { stopReason: 'cancelled' as const };
      throw error;
    })
    .finally(() => {
      session.running = undefined;
    });
}

function announceCommands(sessionId: string, client: AgentContext): void {
  setTimeout(() => {
    void client.notify(methods.client.session.update, {
      sessionId,
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: [{ name: 'compact', description: 'Compact' }],
      },
    });
  }, 0);
}

async function create(setup: NewSessionRequest, client: AgentContext) {
  const sessionId = await sessions.create(setup);
  announceCommands(sessionId, client);
  return { sessionId, ...offered(sessions.get(sessionId).config) };
}

async function load(
  { sessionId, ...setup }: LoadSessionRequest,
  client: AgentContext,
): Promise<object> {
  const session = await sessions.load(sessionId, setup);
  await Promise.all(
    session.updates.map((update) =>
      client.notify(methods.client.session.update, { sessionId, update }),
    ),
  );
  return offered(session.config);
}

function setConfigOption(request: SetSessionConfigOptionRequest) {
  if (flags['set-config-fails']) throw new Error('The option cannot be set');
  const session = sessions.get(request.sessionId);
  session.config = configured(session.config, request);
  return { configOptions: [], ...offered(session.config) };
}

async function steer(
  params: z.infer<typeof steeringSchema>,
  client: AgentContext,
) {
  const session = sessions.get(params.sessionId);
  if (!session.running) {
    const required = params.idleBehavior === 'promptRequired';
    return { outcome: required ? 'promptRequired' : 'startedNewTurn' };
  }
  const steered = params.prompt.map((block) => block.text).join('');
  const update = said(`steered: ${steered}`);
  await emitter(params.sessionId, client)(update);
  return { outcome: 'injected' };
}

agent({ name: 'mock-agent' })
  .onRequest(methods.agent.initialize, ({ params }) => {
    capabilities = params.clientCapabilities;
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: !flags['no-load-session'] },
    };
  })
  .onRequest(methods.agent.session.new, ({ params, client }) =>
    create(params, client),
  )
  .onRequest(methods.agent.session.load, ({ params, client }) =>
    load(params, client),
  )
  .onRequest(methods.agent.session.setConfigOption, ({ params }) =>
    setConfigOption(params),
  )
  .onRequest(methods.agent.session.list, ({ params }) =>
    sessions.list(params.cursor),
  )
  .onRequest(methods.agent.session.fork, async ({ params }) => ({
    sessionId: await sessions.fork(params.sessionId, params.cwd),
  }))
  .onRequest(methods.agent.session.close, ({ params }) => {
    sessions.close(params.sessionId);
    return {};
  })
  .onRequest(methods.agent.session.delete, async ({ params }) => {
    await sessions.delete(params.sessionId);
    return {};
  })
  .onRequest(methods.agent.session.prompt, ({ params, client }) =>
    prompt(params, client),
  )
  .onRequest('_session/steering', steeringSchema, ({ params, client }) =>
    steer(params, client),
  )
  .onNotification(methods.agent.session.cancel, ({ params }) => {
    sessions.find(params.sessionId)?.running?.abort();
  })
  .connect(
    ndJsonStream(Writable.toWeb(process.stdout), readableStream(process.stdin)),
  );
