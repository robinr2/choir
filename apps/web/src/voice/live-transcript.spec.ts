import { beforeEach, expect, test, vi } from 'vitest';
import type { TranscriptMessage } from '@/conversation/transcript';
import { LiveTranscript } from './live-transcript';

const show = vi.fn<(text: string) => void>();
let transcript: LiveTranscript;

function turns(...roles: TranscriptMessage['role'][]): TranscriptMessage[] {
  return roles.map((role, index) => ({ id: `m${index}`, role, parts: [] }));
}

beforeEach(() => {
  show.mockClear();
  transcript = new LiveTranscript(show);
});

test('shows the words while the user speaks', () => {
  transcript.heard({ text: 'hel', final: false });
  transcript.heard({ text: 'hello', final: true });
  transcript.heard({ text: 'cho', final: false });
  transcript.heard({ text: 'choir', final: true });
  expect(show.mock.calls).toEqual([
    ['hel'],
    ['hello'],
    ['hello cho'],
    ['hello choir'],
  ]);
});

test('clears the words once the user turn is sent', () => {
  transcript.saw(turns('user'));
  transcript.heard({ text: 'hello', final: true });
  transcript.saw(turns('user', 'assistant'));
  transcript.heard({ text: 'choir', final: true });
  transcript.saw(turns('user', 'assistant', 'user'));
  transcript.heard({ text: 'again', final: false });
  expect(show.mock.calls).toEqual([
    [''],
    ['hello'],
    ['hello choir'],
    [''],
    ['again'],
  ]);
});
