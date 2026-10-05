import { RTVIEvent } from '@pipecat-ai/client-js';
import { PipecatClientProvider } from '@pipecat-ai/client-react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { CoreConversation } from '@/conversation/core-conversation';
import type { TranscriptMessage } from '@/conversation/transcript';
import { CoreEvents } from '@/lib/core-events';
import { A, coreShowsChat, fakeCore } from '@/test/fake-core';
import { client } from '@/test/render-app';
import { SpokenReply } from './spoken-reply';
import { SpokenReplyFollower } from './spoken-reply-follower';

const HI: TranscriptMessage = {
  id: 'm0',
  role: 'user',
  parts: [{ type: 'text', text: 'hi' }],
};

const AGAIN: TranscriptMessage = {
  id: 'm1',
  role: 'user',
  parts: [{ type: 'text', text: 'again' }],
};

let conversation: CoreConversation;

function follower(reply: SpokenReply) {
  return (
    <PipecatClientProvider client={client}>
      <SpokenReplyFollower conversation={conversation} reply={reply} />
    </PipecatClientProvider>
  );
}

function botSaid(accumulated_text: string): void {
  client.emit(RTVIEvent.BotOutput, {
    text: accumulated_text,
    aggregated_by: 'sentence',
    segment_id: 1,
    will_be_spoken: true,
    spoken_progress: { accumulated_text, remaining_text: '' },
  });
}

beforeEach(() => {
  fakeCore();
  conversation = new CoreConversation(A, new CoreEvents().conversation(A));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('waits for the conversation to load before it counts the turns', async () => {
  const reply = new SpokenReply();
  await render(follower(reply));
  coreShowsChat(A, HI);
  expect(reply.getSnapshot().live).toBe(false);
  coreShowsChat(A, HI, AGAIN);
  expect(reply.getSnapshot().live).toBe(true);
});

test('hands what the bot says to the reply it is given now', async () => {
  const first = new SpokenReply();
  const second = new SpokenReply();
  const screen = await render(follower(first));
  await screen.rerender(follower(second));
  coreShowsChat(A, HI);
  coreShowsChat(A, HI, AGAIN);
  botSaid('Hello.');
  expect(second.getSnapshot().spoken).toBe('Hello.');
});

test('starts the reply over once it stops following', async () => {
  const reply = new SpokenReply();
  const screen = await render(follower(reply));
  coreShowsChat(A, HI);
  coreShowsChat(A, HI, AGAIN);
  expect(reply.getSnapshot().live).toBe(true);
  await screen.unmount();
  expect(reply.getSnapshot().live).toBe(false);
  coreShowsChat(A, HI);
  coreShowsChat(A, HI, AGAIN);
  expect(reply.getSnapshot().live).toBe(false);
});
