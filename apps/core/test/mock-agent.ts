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
  type SetSessionConfigOptionRequest,
} from '@agentclientprotocol/sdk';
import { z } from 'zod';
import { type Config, configOptions, configured } from './mock-agent-config.js';
import { MockSessions } from './mock-agent-sessions.js';
import { MockTurns, UPDATE } from './mock-agent-turns.js';
import { readableStream } from '../src/agent/agent-process.js';

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

const turns = new MockTurns(sessions, {
  respond: flags.respond,
  stopReason: flags['stop-reason'],
});

function offered(config: Config) {
  return flags['no-config-options']
    ? {}
    : { configOptions: configOptions(config) };
}

function announceCommands(sessionId: string, client: AgentContext): void {
  setTimeout(() => {
    void client.notify(methods.client.session.update, {
      sessionId,
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: [
          { name: 'compact', description: 'Compact' },
          { name: 'review', description: 'Review', input: { hint: 'pr' } },
        ],
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
  await session.updates.reduce(
    (previous, notification) =>
      previous.then(() => client.notify(UPDATE, notification)),
    Promise.resolve(),
  );
  announceCommands(sessionId, client);
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
  if (params.idleBehavior !== 'promptRequired') {
    throw new Error('Steering needs the promptRequired idle behavior');
  }
  if (!sessions.get(params.sessionId).running) {
    return { outcome: 'promptRequired' };
  }
  turns.steer(params, client);
  return { outcome: 'injected' };
}

agent({ name: 'mock-agent' })
  .onRequest(methods.agent.initialize, ({ params }) => {
    turns.capabilities = params.clientCapabilities;
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
    turns.prompt(params, client),
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
