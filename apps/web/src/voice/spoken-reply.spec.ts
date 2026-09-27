import type { BotOutputData } from '@pipecat-ai/client-js';
import { beforeEach, expect, test, vi } from 'vitest';
import type { TranscriptMessage } from '@/conversation/transcript';
import { SpokenReply } from './spoken-reply';

let reply: SpokenReply;

function turns(...roles: TranscriptMessage['role'][]): TranscriptMessage[] {
  return roles.map((role, index) => ({ id: `m${index}`, role, parts: [] }));
}

function progress(
  accumulated_text: string,
  segment_id?: number,
): BotOutputData {
  return {
    text: accumulated_text,
    aggregated_by: 'sentence',
    segment_id,
    will_be_spoken: true,
    spoken_progress: { accumulated_text, remaining_text: '' },
  };
}

beforeEach(() => {
  reply = new SpokenReply();
});

test('follows only replies to turns that come after it starts', () => {
  reply.heard(progress('Hello.', 1));
  expect(reply.getSnapshot()).toEqual({ live: false, spoken: '' });
  reply.saw(turns('user', 'assistant'));
  reply.heard(progress('Hello.', 1));
  expect(reply.getSnapshot()).toEqual({ live: false, spoken: '' });
  reply.saw(turns('user', 'assistant', 'user'));
  expect(reply.getSnapshot()).toEqual({ live: true, spoken: '' });
});

test('collects what the bot has spoken so far, segment by segment', () => {
  reply.saw(turns());
  reply.saw(turns('user'));
  reply.heard(progress('', 1));
  reply.heard(progress('Once', 1));
  reply.heard(progress('Once upon a time.', 1));
  reply.heard(progress('The', 2));
  expect(reply.getSnapshot().spoken).toBe('Once upon a time. The');
  reply.heard(progress('end.'));
  expect(reply.getSnapshot().spoken).toBe('Once upon a time. The');
  reply.heard(progress('The end.', 2));
  reply.heard(progress('', 3));
  expect(reply.getSnapshot().spoken).toBe('Once upon a time. The end.');
});

test('ignores bot output that is not spoken', () => {
  reply.saw(turns());
  reply.saw(turns('user'));
  reply.heard({ text: '```', aggregated_by: 'code', will_be_spoken: false });
  expect(reply.getSnapshot().spoken).toBe('');
});

test('starts over with the next user turn and tells its listeners', () => {
  const listener = vi.fn<() => void>();
  const stop = reply.subscribe(listener);
  reply.saw(turns());
  reply.saw(turns('user'));
  reply.heard(progress('Hello.', 1));
  reply.saw(turns('user', 'assistant'));
  reply.saw(turns('user', 'assistant', 'user'));
  expect(reply.getSnapshot()).toEqual({ live: true, spoken: '' });
  reply.heard(progress('Hi.', 2));
  expect(reply.getSnapshot().spoken).toBe('Hi.');
  expect(listener).toHaveBeenCalledTimes(5);
  stop();
  reply.heard(progress('Hi there.', 2));
  expect(listener).toHaveBeenCalledTimes(5);
});

test('starts over when it follows a conversation again', () => {
  reply.saw(turns());
  reply.saw(turns('user'));
  reply.heard(progress('Hello.', 1));
  expect(reply.getSnapshot()).toEqual({ live: true, spoken: 'Hello.' });
  reply.restart();
  expect(reply.getSnapshot()).toEqual({ live: false, spoken: '' });
  reply.saw(turns('user', 'assistant', 'user'));
  expect(reply.getSnapshot()).toEqual({ live: false, spoken: '' });
});
