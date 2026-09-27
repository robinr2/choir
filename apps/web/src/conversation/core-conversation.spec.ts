import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FakeEventSource, fakeEventSources } from '@/test/fake-event-source';
import { CoreConversation } from './core-conversation';
import type { TranscriptMessage } from './transcript';

const said: TranscriptMessage[] = [
  { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
];

let conversation: CoreConversation;

beforeEach(() => {
  fakeEventSources();
  conversation = new CoreConversation('c1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('follows the conversation while anyone listens', () => {
  const first = vi.fn<() => void>();
  const second = vi.fn<() => void>();
  expect(conversation.getSnapshot()).toEqual({ messages: [], running: false });
  const stopFirst = conversation.subscribe(first);
  const stopSecond = conversation.subscribe(second);
  const [source] = FakeEventSource.opened;
  expect(FakeEventSource.opened).toHaveLength(1);
  expect(source?.url).toBe('/conversations/c1/events');
  source?.receive({ messages: said });
  expect(conversation.getSnapshot()).toEqual({
    messages: said,
    running: false,
  });
  expect(first).toHaveBeenCalledOnce();
  stopFirst();
  expect(source?.closed).toBe(false);
  stopSecond();
  expect(source?.closed).toBe(true);
  conversation.subscribe(first);
  expect(FakeEventSource.opened).toHaveLength(2);
});

test('ignores events it cannot read', () => {
  const listener = vi.fn<() => void>();
  conversation.subscribe(listener);
  const [source] = FakeEventSource.opened;
  source?.receive(null);
  source?.receive({});
  expect(listener).not.toHaveBeenCalled();
  expect(conversation.getSnapshot()).toEqual({ messages: [], running: false });
});

test('sends a typed turn and runs until its answer is complete', async () => {
  const fetch = vi
    .spyOn(window, 'fetch')
    .mockResolvedValue(new Response('data: {"text":"Hi"}\n\n'));
  const listener = vi.fn<() => void>();
  conversation.subscribe(listener);
  const sent = conversation.send('hello choir');
  expect(conversation.getSnapshot().running).toBe(true);
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    '/conversations/c1/user-turns',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello choir' }),
    },
  );
  await sent;
  expect(conversation.getSnapshot().running).toBe(false);
  expect(listener).toHaveBeenCalledTimes(2);
});

test('stops running when the conversation rejects the turn', async () => {
  vi.spyOn(window, 'fetch').mockResolvedValue(
    new Response('', { status: 500 }),
  );
  await expect(conversation.send('hello')).rejects.toThrow(
    new Error('POST /conversations/c1/user-turns replied with status 500'),
  );
  expect(conversation.getSnapshot().running).toBe(false);
});
