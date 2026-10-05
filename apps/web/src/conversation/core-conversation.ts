import type { CatalogChoice, CatalogModel } from '@/agents/core-agents';
import { LiveStore, send } from '@/lib/live-store';
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

export type ConversationState = {
  messages: TranscriptMessage[];
  session: { id: string; title: string | null; cwd: string } | null;
  status: { state: StatusState; since: number };
  queue: QueuedTurn[];
  settings: Settings | null;
  usage: Usage | null;
  commands: Command[];
};

export type ConversationSnapshot = ConversationState & { loaded: boolean };

export type Image = { data: string; mimeType: string };

export type Turn = { text: string; images: Image[] };

export class CoreConversation extends LiveStore<ConversationSnapshot> {
  readonly id: string;

  constructor(id: string) {
    super(`/conversations/${id}/events`, {
      messages: [],
      session: null,
      status: { state: 'starting', since: 0 },
      queue: [],
      settings: null,
      usage: null,
      commands: [],
      loaded: false,
    });
    this.id = id;
  }

  async send(turn: Turn): Promise<void> {
    const response = await send('POST', this.#path('user-turns'), turn);
    await response.text();
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

  protected receive(state: ConversationState): void {
    this.update({ ...state, loaded: true });
  }

  #path(rest: string): string {
    return `/conversations/${this.id}/${rest}`;
  }
}
