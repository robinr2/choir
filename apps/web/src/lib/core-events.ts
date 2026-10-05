import type { Feed } from './live-store';

type Receive = Parameters<Feed>[0];

export type Source = 'workspace' | 'inbox' | 'rate-limits';

const SOURCES: readonly Source[] = ['workspace', 'inbox', 'rate-limits'];

type Receivers = Map<string, Set<Receive>>;

function parsed({ data }: MessageEvent<string>): any {
  return JSON.parse(data);
}

function deliver(receivers: Set<Receive> | undefined, data: unknown): void {
  for (const receive of receivers ?? []) receive(data);
}

export class CoreEvents {
  #source?: EventSource;
  #connection?: string;
  #registering: Promise<unknown> = Promise.resolve();
  readonly #sources: Receivers = new Map();
  readonly #conversations: Receivers = new Map();

  feed(source: Source): Feed {
    return (receive) => this.#listen(this.#sources, source, receive);
  }

  conversation(id: string): Feed {
    return (receive) => {
      if (!this.#conversations.has(id)) this.#register('PUT', id);
      const stop = this.#listen(this.#conversations, id, receive);
      return () => {
        stop();
        if (!this.#conversations.has(id)) this.#register('DELETE', id);
      };
    };
  }

  #listen(receivers: Receivers, key: string, receive: Receive): () => void {
    const listening = receivers.get(key) ?? new Set<Receive>();
    listening.add(receive);
    receivers.set(key, listening);
    this.#source ??= this.#open();
    return () => {
      listening.delete(receive);
      if (listening.size === 0) receivers.delete(key);
      if (this.#sources.size + this.#conversations.size > 0) return;
      this.#source?.close();
      this.#source = undefined;
      this.#connection = undefined;
    };
  }

  #register(method: 'PUT' | 'DELETE', id: string): void {
    const connection = this.#connection;
    if (!connection) return;
    const url = `/events/${connection}/conversations/${id}`;
    this.#registering = this.#registering
      .then(() => fetch(url, { method }))
      .catch(() => undefined);
  }

  #connected(connection: string): void {
    this.#connection = connection;
    for (const id of this.#conversations.keys()) this.#register('PUT', id);
  }

  #open(): EventSource {
    const source = new EventSource('/events');
    source.addEventListener('connection', (event) => {
      this.#connected(parsed(event).id);
    });
    for (const name of SOURCES) {
      source.addEventListener(name, (event) => {
        deliver(this.#sources.get(name), parsed(event));
      });
    }
    source.addEventListener('conversation', (event) => {
      const { id, state } = parsed(event);
      deliver(this.#conversations.get(id), state);
    });
    return source;
  }
}
