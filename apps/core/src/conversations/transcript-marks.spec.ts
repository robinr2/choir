import type { TranscriptMessage } from './transcript.js';
import { withMarks } from './transcript-marks.js';

const IMAGE = { type: 'image', image: 'data:image/png;base64,aGk=' } as const;

function user(id: string, text: string): TranscriptMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }, IMAGE] };
}

function reply(id: string): TranscriptMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text: 'ok' }] };
}

it('marks who sent a message, what to show of it and how its reply was heard', () => {
  const from = { id: 'a2', name: 'helper' };
  const marks = new Map([
    ['spoken', { voice: true as const, aloud: true as const, heard: 'o' }],
    ['framed prompt', { from, text: 'hello', aloud: true as const }],
  ]);
  expect(
    withMarks(
      [
        reply('m0'),
        user('m1', 'spoken'),
        reply('m2'),
        user('m3', 'framed prompt'),
        reply('m4'),
        user('m5', 'typed'),
        reply('m6'),
      ],
      marks,
    ),
  ).toStrictEqual([
    reply('m0'),
    user('m1', 'spoken'),
    { ...reply('m2'), spoken: true, heard: 'o' },
    { ...user('m3', 'hello'), from },
    { ...reply('m4'), spoken: true },
    user('m5', 'typed'),
    reply('m6'),
  ]);
});
