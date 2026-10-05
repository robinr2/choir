import type { CatalogChoice, CatalogModel } from '@/agents/core-agents';
import { type Feed, LiveStore, send } from '@/lib/live-store';
import type { TranscriptMessage } from './transcript';

export type StatusState =
  'starting' | 'idle' | 'working' | 'waiting' | 'failed';

type Settings = {
  model: string;
  effort: string | null;
  mode: string;
  models: CatalogModel[];
  modes: CatalogChoice[];
};

export type SettingsChange = Partial<
  Record<'model' | 'effort' | 'mode', string>
>;

export type Command = {
  name: string;
  description: string;
  hint: string | null;
};

type Usage = { used: number; size: number; cost: number | null };

export type QueuedTurn = { id: string; text: string; images: number };

type PlanEntry = {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
};

export type Fork = {
  id: string;
  sessionId: string;
  title: string;
  state: 'running' | 'ready' | 'failed';
  startedAt: number;
  endedAt: number | null;
};

export type Answer =
  | { optionId: string }
  | {
      action: 'accept';
      content?: Record<string, string | string[] | boolean | number>;
    }
  | { action: 'decline' | 'cancel' };

export type ConversationState = {
  messages: TranscriptMessage[];
  session: { id: string; title: string | null; cwd: string } | null;
  status: { state: StatusState; since: number };
  queue: QueuedTurn[];
  settings: Settings | null;
  usage: Usage | null;
  commands: Command[];
  plan: PlanEntry[];
  forks: Fork[];
};

export type ConversationSnapshot = ConversationState & { loaded: boolean };

export type Image = { data: string; mimeType: string };

export type Turn = { text: string; images: Image[] };

export class CoreConversation extends LiveStore<ConversationSnapshot> {
  readonly id: string;

  constructor(id: string, feed: Feed) {
    super(feed, {
      messages: [],
      session: null,
      status: { state: 'starting', since: 0 },
      queue: [],
      settings: null,
      usage: null,
      commands: [],
      plan: [],
      forks: [],
      loaded: false,
    });
    this.id = id;
  }

  async send(turn: Turn): Promise<void> {
    await send('POST', this.#path('queue'), turn);
  }

  async steer(turn: Turn): Promise<void> {
    await send('POST', this.#path('steerings'), turn);
  }

  async steerQueued(itemId: string): Promise<void> {
    await send('POST', this.#path(`queue/${itemId}/steering`));
  }

  async unqueue(itemId: string): Promise<void> {
    await send('DELETE', this.#path(`queue/${itemId}`));
  }

  async cancel(): Promise<void> {
    await send('POST', this.#path('cancellation'));
  }

  async change(settings: SettingsChange): Promise<void> {
    await send('PUT', this.#path('settings'), settings);
  }

  async answer(interactionId: string, answer: Answer): Promise<void> {
    await send('POST', this.#path(`interactions/${interactionId}`), answer);
  }

  protected receive(state: ConversationState): void {
    this.update({ ...state, loaded: true });
  }

  #path(rest: string): string {
    return `/conversations/${this.id}/${rest}`;
  }
}
