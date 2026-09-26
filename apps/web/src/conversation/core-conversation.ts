import type { TranscriptMessage } from './transcript';

export type ConversationSnapshot = {
  messages: readonly TranscriptMessage[];
  running: boolean;
};

type ConversationEvent = { messages: TranscriptMessage[] };

type TypedMessage = { id: string; text: string };

function wordsOf({ parts }: TranscriptMessage): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('');
}

function messagesIn(data: string): TranscriptMessage[] | undefined {
  const event: Partial<ConversationEvent> | null = JSON.parse(data);
  return event?.messages;
}

export class CoreConversation {
  readonly id: string;
  #snapshot: ConversationSnapshot = { messages: [], running: false };
  #source?: EventSource;
  #received: readonly TranscriptMessage[] = [];
  #typed: TypedMessage[] = [];
  readonly #adopted = new Map<string, string>();
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

  adopt(message: TypedMessage): void {
    this.#typed.push(message);
    this.#receive(this.#received);
  }

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
      if (messages) this.#receive(messages);
    });
    return source;
  }

  #receive(messages: readonly TranscriptMessage[]): void {
    this.#received = messages;
    this.#typed = this.#typed.filter((typed) => !this.#adoptFor(typed));
    const id = (message: TranscriptMessage) =>
      this.#adopted.get(message.id) ?? message.id;
    this.#update({
      messages: messages.map((message) => ({ ...message, id: id(message) })),
    });
  }

  #adoptFor({ id, text }: TypedMessage): boolean {
    const match = this.#received.findLast(
      (message) =>
        message.role === 'user' &&
        !this.#adopted.has(message.id) &&
        wordsOf(message).endsWith(text.trim()),
    );
    if (match) this.#adopted.set(match.id, id);
    return match !== undefined;
  }

  #update(change: Partial<ConversationSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    for (const listener of this.#listeners) listener();
  }
}
