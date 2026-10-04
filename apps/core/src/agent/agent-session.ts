import {
  type ClientConnection,
  type ClientContext,
  client,
  type InitializeRequest,
  methods,
  type NewSessionRequest,
  PROTOCOL_VERSION,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionUpdate,
} from '@agentclientprotocol/sdk';
import { CHOIR } from '../choir/choir-config.js';
import { type AgentLaunch, AgentProcess } from './agent-process.js';
import { type AgentTurn, PromptTurn } from './prompt-turn.js';

export type SessionSetup = NewSessionRequest;

type Receiver = { push(update: SessionUpdate): unknown };

const BYPASS_PERMISSIONS = 'bypassPermissions';

const INITIALIZE: InitializeRequest = {
  protocolVersion: PROTOCOL_VERSION,
  clientInfo: CHOIR,
};

function approve({
  options,
}: RequestPermissionRequest): RequestPermissionResponse {
  const allow = options.find(({ kind }) => kind.startsWith('allow'));
  if (!allow) return { outcome: { outcome: 'cancelled' } };
  return { outcome: { outcome: 'selected', optionId: allow.optionId } };
}

export class AgentSession {
  readonly history: SessionUpdate[] = [];
  private readonly agentProcess: AgentProcess;
  private readonly connection: ClientConnection;
  private sessionId = '';
  private receiver?: Receiver;
  private queue = Promise.resolve();

  constructor(launch: AgentLaunch) {
    this.agentProcess = new AgentProcess(launch);
    this.connection = client()
      .onNotification(methods.client.session.update, ({ params }) => {
        this.receiver?.push(params.update);
      })
      .onRequest(methods.client.session.requestPermission, ({ params }) =>
        approve(params),
      )
      .connect(this.agentProcess.stream);
  }

  get id(): string {
    return this.sessionId;
  }

  private get agent(): ClientContext {
    return this.connection.agent;
  }

  async start(setup: SessionSetup, sessionId?: string): Promise<void> {
    const { agentCapabilities } = await this.agent.request(
      methods.agent.initialize,
      INITIALIZE,
    );
    if (!sessionId) await this.create(setup);
    else if (agentCapabilities?.loadSession) await this.load(setup, sessionId);
    else throw new Error(`The agent cannot load the session ${sessionId}`);
    await this.agent.request(methods.agent.session.setMode, {
      sessionId: this.sessionId,
      modeId: BYPASS_PERMISSIONS,
    });
  }

  startTurn(text: string): AgentTurn {
    const turn = new PromptTurn(() =>
      this.agent.notify(methods.agent.session.cancel, {
        sessionId: this.sessionId,
      }),
    );
    this.queue = this.queue.then(() => this.run(turn, text));
    return turn;
  }

  async close(): Promise<void> {
    await this.agentProcess.stop();
  }

  private async create(setup: SessionSetup): Promise<void> {
    const created = await this.agent.request(methods.agent.session.new, setup);
    this.sessionId = created.sessionId;
  }

  private async load(setup: SessionSetup, sessionId: string): Promise<void> {
    this.receiver = this.history;
    await this.agent.request(methods.agent.session.load, {
      ...setup,
      sessionId,
    });
    this.receiver = undefined;
    this.sessionId = sessionId;
  }

  private async run(turn: PromptTurn, text: string): Promise<void> {
    if (!turn.start()) return;
    this.receiver = turn;
    try {
      const prompt = [{ type: 'text' as const, text }];
      const { sessionId } = this;
      turn.end(
        await this.agent.request(methods.agent.session.prompt, {
          sessionId,
          prompt,
        }),
      );
    } catch (error) {
      turn.fail(error);
    }
  }
}
