export abstract class LiveStore<T extends object> {
  #snapshot: T;
  #source?: EventSource;
  readonly #url: string;
  readonly #listeners = new Set<() => void>();

  protected constructor(url: string, initial: T) {
    this.#url = url;
    this.#snapshot = initial;
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

  readonly getSnapshot = (): T => this.#snapshot;

  protected abstract receive(data: unknown): void;

  protected update(change: Partial<T>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    for (const listener of this.#listeners) listener();
  }

  #open(): EventSource {
    const source = new EventSource(this.#url);
    source.addEventListener('message', ({ data }: MessageEvent<string>) => {
      this.receive(JSON.parse(data));
    });
    return source;
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
