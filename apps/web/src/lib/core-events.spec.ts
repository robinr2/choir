import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  CONNECTION,
  FakeEventSource,
  fakeEventSources,
  requests,
  stream,
} from '@/test/fake-event-source';
import { CoreEvents } from './core-events';

const OTHER = '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9';

let events: CoreEvents;

function watches() {
  return requests().map(([url, method]) => [method, url]);
}

function at(id: string, connection = CONNECTION) {
  return `/events/${connection}/conversations/${id}`;
}

function listener() {
  return vi.fn<(data: unknown) => void>();
}

beforeEach(() => {
  fakeEventSources();
  vi.spyOn(window, 'fetch').mockImplementation(
    async () => new Response(null, { status: 204 }),
  );
  events = new CoreEvents();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('opens one stream for every feed and closes it when nobody listens', () => {
  const workspace = listener();
  const inbox = listener();
  const rateLimits = listener();
  const stopWorkspace = events.feed('workspace')(workspace);
  const stopInbox = events.feed('inbox')(inbox);
  const stopRateLimits = events.feed('rate-limits')(rateLimits);
  const source = stream();
  expect(FakeEventSource.opened).toHaveLength(1);
  expect(source.url).toBe('/events');
  source.emit('workspace', { panes: [] });
  source.emit('inbox', { todos: 1 });
  source.emit('rate-limits', { windows: [] });
  expect(workspace).toHaveBeenCalledExactlyOnceWith({ panes: [] });
  expect(inbox).toHaveBeenCalledExactlyOnceWith({ todos: 1 });
  expect(rateLimits).toHaveBeenCalledExactlyOnceWith({ windows: [] });
  stopInbox();
  stopRateLimits();
  expect(source.closed).toBe(false);
  stopWorkspace();
  expect(source.closed).toBe(true);
  events.feed('inbox')(inbox);
  expect(FakeEventSource.opened).toHaveLength(2);
});

test('tells core which conversations it watches once the stream connects', async () => {
  const first = listener();
  const stopFirst = events.conversation('c1')(first);
  expect(requests()).toEqual([]);
  await vi.waitFor(() => expect(watches()).toEqual([['PUT', at('c1')]]));
  const second = listener();
  const stopSecond = events.conversation('c1')(second);
  const stopOther = events.conversation('c2')(listener());
  const source = stream();
  source.emit('conversation', { id: 'c1', state: { queue: [] } });
  source.emit('conversation', { id: 'c3', state: { queue: [] } });
  expect(first).toHaveBeenCalledExactlyOnceWith({ queue: [] });
  expect(second).toHaveBeenCalledOnce();
  stopFirst();
  await vi.waitFor(() =>
    expect(watches()).toEqual([
      ['PUT', at('c1')],
      ['PUT', at('c2')],
    ]),
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(watches()).toHaveLength(2);
  stopSecond();
  expect(source.closed).toBe(false);
  await vi.waitFor(() =>
    expect(watches()).toEqual([
      ['PUT', at('c1')],
      ['PUT', at('c2')],
      ['DELETE', at('c1')],
    ]),
  );
  stopOther();
  expect(source.closed).toBe(true);
  events.conversation('c3')(listener());
  await vi.waitFor(() => expect(watches()).toHaveLength(4));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(watches().slice(3)).toEqual([['PUT', at('c3')]]);
});

test('watches its conversations again when the stream reconnects', async () => {
  events.conversation('c1')(listener());
  const source = stream();
  source.emit('connection', { id: OTHER });
  await vi.waitFor(() =>
    expect(watches()).toEqual([
      ['PUT', at('c1', OTHER)],
      ['PUT', at('c1')],
    ]),
  );
});

test('sends its watches in order and carries on after one fails', async () => {
  const sent: string[] = [];
  let fail = true;
  vi.mocked(window.fetch).mockImplementation(async (url, init) => {
    sent.push(
      `${init?.method} ${url instanceof Request ? url.url : url.toString()}`,
    );
    if (fail) {
      fail = false;
      throw new TypeError('offline');
    }
    return new Response(null, { status: 204 });
  });
  events.conversation('c1')(listener());
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  events.conversation('c2')(listener());
  events.conversation('c3')(listener());
  await vi.waitFor(() => expect(sent).toHaveLength(3));
  expect(sent).toEqual([
    `PUT ${at('c1')}`,
    `PUT ${at('c2')}`,
    `PUT ${at('c3')}`,
  ]);
});
