import { vi } from 'vitest';

export class FakeEventSource extends EventTarget {
  static opened: FakeEventSource[] = [];
  readonly url: string;
  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.opened.push(this);
  }

  close(): void {
    this.closed = true;
  }

  receive(data: unknown): void {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(data) }),
    );
  }
}

export function fakeEventSources(): void {
  FakeEventSource.opened = [];
  vi.stubGlobal('EventSource', FakeEventSource);
}

export function streamOf(url: string): FakeEventSource | undefined {
  return FakeEventSource.opened.findLast((source) => source.url === url);
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
