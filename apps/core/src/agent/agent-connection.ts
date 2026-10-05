import {
  type AnyMessage,
  type ClientConnection,
  type ClientContext,
  client,
  type CompleteElicitationNotification,
  type CreateElicitationRequest,
  type CreateElicitationResponse,
  type InitializeRequest,
  type InitializeResponse,
  methods,
  PROTOCOL_VERSION,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type Stream,
} from '@agentclientprotocol/sdk';
import { CHOIR } from '../choir/choir-config.js';
import { type AgentLaunch, AgentProcess } from './agent-process.js';
import { type AgentUpdate, agentUpdate, carried } from './agent-updates.js';

export type ConnectionHandlers = {
  update(update: AgentUpdate): void;
  permission(
    request: RequestPermissionRequest,
    signal: AbortSignal,
  ): Promise<RequestPermissionResponse>;
  elicitation(
    request: CreateElicitationRequest,
    signal: AbortSignal,
  ): Promise<CreateElicitationResponse>;
  complete(notification: CompleteElicitationNotification): void;
};

const DECLINING: ConnectionHandlers = {
  update: () => undefined,
  permission: async () => ({ outcome: { outcome: 'cancelled' } }),
  elicitation: async () => ({ action: 'decline' }),
  complete: () => undefined,
};

const INITIALIZE: InitializeRequest = {
  protocolVersion: PROTOCOL_VERSION,
  clientInfo: CHOIR,
  clientCapabilities: {
    session: { notices: {}, compaction: {}, configOptions: { boolean: {} } },
    subagents: {},
    elicitation: { form: {}, url: {} },
  },
};

function carrying(stream: Stream): Stream {
  const carrier = new TransformStream<AnyMessage, AnyMessage>({
    transform(message, controller) {
      controller.enqueue(carried(message));
    },
  });
  return { ...stream, readable: stream.readable.pipeThrough(carrier) };
}

export class AgentConnection {
  private readonly process: AgentProcess;
  private readonly connection: ClientConnection;

  constructor(launch: AgentLaunch, handlers: ConnectionHandlers = DECLINING) {
    this.process = new AgentProcess(launch);
    this.connection = client()
      .onNotification(methods.client.session.update, ({ params }) => {
        handlers.update(agentUpdate(params));
      })
      .onRequest(
        methods.client.session.requestPermission,
        ({ params, signal }) => handlers.permission(params, signal),
      )
      .onRequest(methods.client.elicitation.create, ({ params, signal }) =>
        handlers.elicitation(params, signal),
      )
      .onNotification(methods.client.elicitation.complete, ({ params }) => {
        handlers.complete(params);
      })
      .connect(carrying(this.process.stream));
  }

  get agent(): ClientContext {
    return this.connection.agent;
  }

  get closed(): Promise<void> {
    return this.connection.closed;
  }

  initialize(): Promise<InitializeResponse> {
    return this.agent.request(methods.agent.initialize, INITIALIZE);
  }

  async close(): Promise<void> {
    await this.process.stop();
  }
}
