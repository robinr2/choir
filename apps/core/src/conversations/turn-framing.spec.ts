import { framed } from './turn-framing.js';

const UNFINISHED =
  "The user's last message was not finished. This message continues it.";

describe('framed', () => {
  it('passes a turn on unchanged when nothing came before it', () => {
    expect(framed(undefined, 'hello choir')).toEqual({
      prompt: 'hello choir',
    });
  });

  it('sends only the rest of a turn whose start was withdrawn', () => {
    expect(
      framed({ kind: 'withdrawn', words: 'hello' }, 'hello choir'),
    ).toEqual({ prompt: 'choir', note: UNFINISHED });
  });

  it('sends the whole turn when it does not continue the withdrawn words', () => {
    expect(framed({ kind: 'withdrawn', words: 'hello' }, 'goodbye')).toEqual({
      prompt: 'goodbye',
      note: UNFINISHED,
    });
    expect(framed({ kind: 'withdrawn', words: 'hello' }, 'hello')).toEqual({
      prompt: 'hello',
      note: UNFINISHED,
    });
  });

  it('tells how much of the reply was heard before the user interrupted', () => {
    expect(framed({ kind: 'interrupted', heard: 'It is' }, 'wait')).toEqual({
      prompt: 'wait',
      note: 'The user interrupted your last answer after hearing only: "It is".',
    });
  });
});
