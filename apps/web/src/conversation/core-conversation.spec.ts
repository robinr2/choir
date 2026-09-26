import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoreConversation } from './core-conversation';
import type { TranscriptMessage } from './transcript';

class FakeEventSource extends EventTarget {
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

  receive(messages: TranscriptMessage[]): void {
    this.receiveRaw(JSON.stringify({ messages }));
  }

  receiveRaw(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

const said: TranscriptMessage[] = [
  { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
];

function typed(id: string, text: string): TranscriptMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

let conversation: CoreConversation;

beforeEach(() => {
  FakeEventSource.opened = [];
  vi.stubGlobal('EventSource', FakeEventSource);
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
  source?.receive(said);
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
  source?.receiveRaw('null');
  source?.receiveRaw('{}');
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
    new Error('The conversation replied with status 500'),
  );
  expect(conversation.getSnapshot().running).toBe(false);
});

test('keeps the id of a message typed while voice is on', () => {
  conversation.subscribe(vi.fn<() => void>());
  const [source] = FakeEventSource.opened;
  conversation.adopt({ id: 'local-1', text: 'test ' });
  source?.receive([
    typed('m0', 'test'),
    { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'test' }] },
    typed('m2', 'other'),
  ]);
  conversation.adopt({ id: 'local-2', text: 'go on' });
  source?.receive([
    typed('m0', 'test'),
    typed('m2', 'other'),
    typed('m4', '(The user was not finished and continues:) go on'),
  ]);
  expect(conversation.getSnapshot().messages.map(({ id }) => id)).toEqual([
    'local-1',
    'm2',
    'local-2',
  ]);
});

test('adopts a typed message that the conversation showed first', () => {
  conversation.subscribe(vi.fn<() => void>());
  const [source] = FakeEventSource.opened;
  source?.receive([
    {
      id: 'm0',
      role: 'user',
      parts: [
        { type: 'text', text: 'go ' },
        { type: 'tool-call', toolCallId: 't1', toolName: 'Read', args: {} },
        { type: 'text', text: 'on' },
      ],
    },
  ]);
  conversation.adopt({ id: 'local-1', text: 'go on' });
  expect(conversation.getSnapshot().messages.map(({ id }) => id)).toEqual([
    'local-1',
  ]);
  source?.receive([typed('m0', 'go on'), typed('m2', 'go on')]);
  expect(conversation.getSnapshot().messages.map(({ id }) => id)).toEqual([
    'local-1',
    'm2',
  ]);
});
