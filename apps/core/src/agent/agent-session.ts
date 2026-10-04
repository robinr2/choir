import {
  type ClientContext,
  methods,
  type NewSessionRequest,
  type SessionConfigOption,
  type SessionUpdate,
  type SetSessionConfigOptionRequest,
} from '@agentclientprotocol/sdk';
import {
  BehaviorSubject,
  concatWith,
  defer,
  distinctUntilChanged,
  from,
  type Observable,
  Subject,
} from 'rxjs';
import { AgentConnection } from './agent-connection.js';
import type { AgentLaunch } from './agent-process.js';
import {
  type AgentUpdate,
  isSessionUpdate,
  sessionUpdates,
} from './agent-updates.js';
import {
  type InteractionAnswer,
  type InteractionEvent,
  type InteractionReply,
  Interactions,
} from './interactions.js';
import { type AgentTurn, PromptTurn } from './prompt-turn.js';
import {
  type PromptContent,
  promptBlocks,
  withConfigUpdate,
} from './session-content.js';
import { SessionFamily } from './session-family.js';

export type SessionSetup = NewSessionRequest;

export type SessionStart = { sessionId: string } | { mode?: string };

export type AgentConversation = Pick<AgentSession, 'rootHistory' | 'startTurn'>;

type Steering = { outcome: string };

const BYPASS_PERMISSIONS = 'bypassPermissions';

const STEERING = { steering: { idleBehavior: 'promptRequired' } };

export class AgentSession {
  private readonly connection: AgentConnection;
  private readonly interactionEvents = new Subject<InteractionEvent>();
  private readonly asked = new Interactions((event) =>
    this.interactionEvents.next(event),
  );
  private readonly log: AgentUpdate[] = [];
  private readonly live = new Subject<AgentUpdate>();
  private readonly options = new BehaviorSubject<SessionConfigOption[]>([]);
  private readonly family = new SessionFamily();
  private turn?: PromptTurn;
  private queue = Promise.resolve();

  constructor(launch: AgentLaunch) {
    this.connection = new AgentConnection(launch, {
      update: (update) => this.receive(update),
      permission: (request, signal) => this.asked.permission(request, signal),
      elicitation: (request, signal) => this.asked.elicitation(request, signal),
      complete: (notification) => this.asked.complete(notification),
    });
  }

  get id(): string {
    return this.family.root;
  }

  get history(): readonly AgentUpdate[] {
    return [...this.log];
  }

  get rootHistory(): SessionUpdate[] {
    return sessionUpdates(this.log, this.id);
  }

  get updates(): Observable<AgentUpdate> {
    return defer(() => from(this.history).pipe(concatWith(this.live)));
  }

  get configOptions(): Observable<SessionConfigOption[]> {
    return this.options.pipe(distinctUntilChanged());
  }

  get interactions(): Observable<InteractionEvent> {
    return this.interactionEvents.asObservable();
  }

  private get agent(): ClientContext {
    return this.connection.agent;
  }

  async start(setup: SessionSetup, start: SessionStart = {}): Promise<void> {
    const { agentCapabilities } = await this.connection.initialize();
    if (!('sessionId' in start)) {
      await this.create(setup, start.mode);
    } else if (!agentCapabilities?.loadSession) {
      throw new Error(`The agent cannot load the session ${start.sessionId}`);
    } else {
      await this.load(setup, start.sessionId);
    }
  }

  startTurn(content: PromptContent): AgentTurn {
    const turn = new PromptTurn(() => this.cancel());
    this.queue = this.queue.then(() => this.run(turn, content));
    return turn;
  }

  async steer(content: PromptContent): Promise<AgentTurn | undefined> {
    const { outcome } = await this.agent.request<Steering>(
      '_session/steering',
      { sessionId: this.id, prompt: promptBlocks(content), _meta: STEERING },
    );
    if (outcome !== 'promptRequired') return undefined;
    return this.startTurn(content);
  }

  async cancel(): Promise<void> {
    this.asked.cancelAll();
    await this.agent.notify(methods.agent.session.cancel, {
      sessionId: this.id,
    });
  }

  respond(interactionId: string, answer: InteractionAnswer): InteractionReply {
    return this.asked.respond(interactionId, answer);
  }

  async setConfigOption(
    configId: string,
    value: string | boolean,
  ): Promise<SessionConfigOption[]> {
    const sessionId = this.id;
    const request: SetSessionConfigOptionRequest =
      typeof value === 'boolean'
        ? { sessionId, configId, type: 'boolean', value }
        : { sessionId, configId, value };
    const { configOptions } = await this.agent.request(
      methods.agent.session.setConfigOption,
      request,
    );
    this.options.next(configOptions);
    return configOptions;
  }

  async close(): Promise<void> {
    await this.connection.close();
  }

  private async create(setup: SessionSetup, mode?: string): Promise<void> {
    const created = await this.agent.request(methods.agent.session.new, setup);
    this.family.root = created.sessionId;
    this.options.next(created.configOptions ?? []);
    await this.setConfigOption('mode', mode ?? BYPASS_PERMISSIONS);
  }

  private async load(setup: SessionSetup, sessionId: string): Promise<void> {
    this.family.root = sessionId;
    const loaded = await this.agent.request(methods.agent.session.load, {
      ...setup,
      sessionId,
    });
    this.options.next(loaded.configOptions ?? []);
    await this.setConfigOption('mode', BYPASS_PERMISSIONS);
  }

  private receive(received: AgentUpdate): void {
    if (!this.family.admits(received)) return;
    const { sessionId, update } = received;
    if (sessionId === this.id && isSessionUpdate(update)) {
      this.options.next(withConfigUpdate(this.options.value, update));
      this.turn?.push(update);
    }
    this.log.push(received);
    this.live.next(received);
  }

  private async run(turn: PromptTurn, content: PromptContent): Promise<void> {
    if (!turn.start()) return;
    this.turn = turn;
    try {
      const sessionId = this.id;
      const prompt = promptBlocks(content);
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
