import type { TranscriptMessage } from './transcript';

export type ConversationSnapshot = {
  messages: readonly TranscriptMessage[];
  running: boolean;
};

type ConversationEvent = { messages: TranscriptMessage[] };

function messagesIn(data: string): TranscriptMessage[] | undefined {
  const event: Partial<ConversationEvent> | null = JSON.parse(data);
  return event?.messages;
}

export class CoreConversation {
  readonly id: string;
  #snapshot: ConversationSnapshot = { messages: [], running: false };
  #source?: EventSource;
  readonly #listeners = new Set<() => void>();

  constructor(id: string) {
    this.id = id;
  }

  get #path(): string {
    return `/conversations/${this.id}`;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    this.#source ??= this.#open();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size > 0) return;
      this.#source?.close();
      this.#source = undefined;
    };
  };

  readonly getSnapshot = (): ConversationSnapshot => this.#snapshot;

  async send(text: string): Promise<void> {
    this.#update({ running: true });
    try {
      const response = await fetch(`${this.#path}/user-turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error(
          `The conversation replied with status ${response.status}`,
        );
      }
      await response.text();
    } finally {
      this.#update({ running: false });
    }
  }

  #open(): EventSource {
    const source = new EventSource(`${this.#path}/events`);
    source.addEventListener('message', ({ data }: MessageEvent<string>) => {
      const messages = messagesIn(data);
      if (messages) this.#update({ messages });
    });
    return source;
  }

  #update(change: Partial<ConversationSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    for (const listener of this.#listeners) listener();
  }
}
