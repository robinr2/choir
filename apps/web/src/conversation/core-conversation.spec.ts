import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { conversationState } from '@/test/fake-core';
import {
  FakeEventSource,
  fakeEventSources,
  requests,
} from '@/test/fake-event-source';
import { CoreConversation } from './core-conversation';

const IMAGE = { data: 'iVBOR', mimeType: 'image/png' };

let conversation: CoreConversation;

beforeEach(() => {
  fakeEventSources();
  conversation = new CoreConversation('c1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('follows the state of the conversation while anyone listens', () => {
  const first = vi.fn<() => void>();
  const second = vi.fn<() => void>();
  expect(conversation.getSnapshot()).toEqual({
    ...conversationState({ status: { state: 'starting', since: 0 } }),
    loaded: false,
  });
  const stopFirst = conversation.subscribe(first);
  const stopSecond = conversation.subscribe(second);
  const [source] = FakeEventSource.opened;
  expect(FakeEventSource.opened).toHaveLength(1);
  expect(source?.url).toBe('/conversations/c1/events');
  const state = conversationState({
    status: { state: 'working', since: 5 },
    queue: [{ id: 'q1', text: 'next', images: 0 }],
  });
  source?.receive(state);
  expect(conversation.getSnapshot()).toEqual({ ...state, loaded: true });
  expect(first).toHaveBeenCalledOnce();
  stopFirst();
  expect(source?.closed).toBe(false);
  stopSecond();
  expect(source?.closed).toBe(true);
});

test('sends a turn with its images and reads its answer to the end', async () => {
  const fetch = vi
    .spyOn(window, 'fetch')
    .mockResolvedValue(new Response('data: {"text":"Hi"}\n\n'));
  await conversation.send({ text: 'look', images: [IMAGE] });
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    '/conversations/c1/user-turns',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'look', images: [IMAGE] }),
    },
  );
});

test('steers, unqueues, cancels, changes settings and answers in core', async () => {
  vi.spyOn(window, 'fetch').mockImplementation(
    async () => new Response(null, { status: 204 }),
  );
  await conversation.steer({ text: 'faster', images: [] });
  await conversation.steerQueued('q1');
  await conversation.unqueue('q2');
  await conversation.cancel();
  await conversation.change({ model: 'haiku' });
  await conversation.answer('i1', { optionId: 'allow' });
  await conversation.answer('i2', { action: 'decline' });
  expect(requests()).toEqual([
    ['/conversations/c1/steerings', 'POST', { text: 'faster', images: [] }],
    ['/conversations/c1/queue/q1/steering', 'POST', undefined],
    ['/conversations/c1/queue/q2', 'DELETE', undefined],
    ['/conversations/c1/cancellation', 'POST', undefined],
    ['/conversations/c1/settings', 'PUT', { model: 'haiku' }],
    ['/conversations/c1/interactions/i1', 'POST', { optionId: 'allow' }],
    ['/conversations/c1/interactions/i2', 'POST', { action: 'decline' }],
  ]);
});

test('fails a turn core rejects', async () => {
  vi.spyOn(window, 'fetch').mockResolvedValue(
    new Response('', { status: 400 }),
  );
  await expect(conversation.send({ text: '', images: [] })).rejects.toThrow(
    new Error('POST /conversations/c1/user-turns replied with status 400'),
  );
});
