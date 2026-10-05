export type Feed = (receive: (data: any) => void) => () => void;

export abstract class LiveStore<T extends object> {
  #snapshot: T;
  #stop?: () => void;
  readonly #feed: Feed;
  readonly #listeners = new Set<() => void>();

  protected constructor(feed: Feed, initial: T) {
    this.#feed = feed;
    this.#snapshot = initial;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    this.#stop ??= this.#feed((data) => this.receive(data));
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size > 0) return;
      this.#stop?.();
      this.#stop = undefined;
    };
  };

  readonly getSnapshot = (): T => this.#snapshot;

  protected abstract receive(data: unknown): void;

  protected update(change: Partial<T>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    for (const listener of this.#listeners) listener();
  }
}

export async function send(
  method: string,
  url: string,
  body?: object,
): Promise<Response> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} ${url} replied with status ${response.status}`);
  }
  return response;
}
