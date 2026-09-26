import { framed } from './turn-framing.js';

describe('framed', () => {
  it('passes a turn on unchanged when nothing came before it', () => {
    expect(framed(undefined, 'hello choir')).toBe('hello choir');
  });

  it('sends only the rest of a turn whose start was withdrawn', () => {
    expect(framed({ kind: 'withdrawn', words: 'hello' }, 'hello choir')).toBe(
      '(The user was not finished and continues:) choir',
    );
  });

  it('sends the whole turn when it does not continue the withdrawn words', () => {
    expect(framed({ kind: 'withdrawn', words: 'hello' }, 'goodbye')).toBe(
      '(The user was not finished and continues:) goodbye',
    );
    expect(framed({ kind: 'withdrawn', words: 'hello' }, 'hello')).toBe(
      '(The user was not finished and continues:) hello',
    );
  });

  it('tells how much of the reply was heard before the user interrupted', () => {
    expect(framed({ kind: 'interrupted', heard: 'It is' }, 'wait')).toBe(
      '(The user interrupted you after hearing only: "It is". They continue:) wait',
    );
  });
});
