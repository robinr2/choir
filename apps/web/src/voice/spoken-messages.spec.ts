import { expect, test } from 'vitest';
import type { TranscriptMessage } from '@/conversation/transcript';
import { withSpeech } from './spoken-messages';

const QUIET = { live: false, spoken: '' };

function said(
  id: string,
  role: TranscriptMessage['role'],
  text: string,
  marks: Partial<TranscriptMessage> = {},
): TranscriptMessage {
  return { id, role, parts: [{ type: 'text', text }], ...marks };
}

function spokenPartsOf(messages: readonly TranscriptMessage[], speech = QUIET) {
  return withSpeech(messages, speech).map((message) =>
    'spokenUpTo' in message ? message.spokenUpTo : 'unspoken',
  );
}

test('shows replies that were spoken in full unless they were cut off', () => {
  expect(
    spokenPartsOf([
      said('m0', 'assistant', 'Welcome.'),
      said('m1', 'user', 'hi'),
      said('m2', 'assistant', 'Hello.', { spoken: true }),
      said('m3', 'user', 'typed'),
      said('m4', 'assistant', 'Written.'),
      said('m5', 'user', 'story'),
      said('m6', 'assistant', 'Once upon', { spoken: true, heard: 'Once' }),
    ]),
  ).toEqual(['unspoken', 'unspoken', 6, 'unspoken', 'unspoken', 'unspoken', 4]);
});

test('follows the live reply across its messages as it is spoken', () => {
  const messages = [
    said('m0', 'user', 'hi'),
    said('m1', 'assistant', 'Hello.', { spoken: true, heard: '' }),
    said('m2', 'user', 'story'),
    said('m3', 'assistant', 'Once upon', { spoken: true }),
    said('m4', 'assistant', 'a time.', { spoken: true }),
  ];
  expect(
    spokenPartsOf(messages, { live: true, spoken: 'Once upon a' }),
  ).toEqual(['unspoken', 0, 'unspoken', 9, 1]);
});

test('leaves the last reply alone when speech is not following it', () => {
  expect(
    spokenPartsOf(
      [
        said('m0', 'user', 'hi'),
        said('m1', 'assistant', 'Hello.', { spoken: true }),
      ],
      { live: false, spoken: 'nothing' },
    ),
  ).toEqual(['unspoken', 6]);
});
