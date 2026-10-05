import { vi } from 'vitest';

export const CONNECTION = 'c0ffee00-1d2e-4f3a-8b4c-5d6e7f8a9b0c';

export class FakeEventSource extends EventTarget {
  static opened: FakeEventSource[] = [];
  readonly url: string;
  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.opened.push(this);
    queueMicrotask(() => this.emit('connection', { id: CONNECTION }));
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    if (this.closed) return;
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

export function fakeEventSources(): void {
  FakeEventSource.opened = [];
  vi.stubGlobal('EventSource', FakeEventSource);
}

export function stream(index = 0): FakeEventSource {
  const source = FakeEventSource.opened[index];
  if (!source) throw new Error(`No event stream ${index} is open`);
  return source;
}

export function coreSends(type: string, data: unknown): void {
  for (const source of FakeEventSource.opened) source.emit(type, data);
}

function bodyOf(init: RequestInit | undefined): unknown {
  return typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
}

export function requests(): [string, string | undefined, unknown][] {
  return vi
    .mocked(window.fetch)
    .mock.calls.map(([url, init]) => [
      url instanceof Request ? url.url : url.toString(),
      init?.method,
      bodyOf(init),
    ]);
}

const WATCH = /^\/events\/[^/]+\/conversations\/(.+)$/;

function watchOf([url, method]: [string, string | undefined, unknown]) {
  const id = WATCH.exec(url)?.[1];
  return id ? [[id, method === 'PUT'] as const] : [];
}

export function watchedConversations(): string[] {
  const watching = new Map(requests().flatMap(watchOf));
  return [...watching].filter(([, on]) => on).map(([id]) => id);
}
