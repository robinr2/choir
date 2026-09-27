import { expect, test } from 'vitest';
import { spokenLengths } from './spoken-lengths';

test('reaches the end of the last word spoken', () => {
  expect(spokenLengths(['Once upon a time.'], 'Once upon')).toEqual([9]);
  expect(spokenLengths(['Once upon a time.'], 'once upon a time')).toEqual([
    17,
  ]);
});

test('speaks nothing before the first word is heard', () => {
  expect(spokenLengths(['Once upon a time.'], '')).toEqual([0]);
});

test('matches words however the speech engine writes them', () => {
  expect(spokenLengths(['Well, it’s done.'], 'well its')).toEqual([10]);
  expect(spokenLengths(['Café au lait.'], 'CAFE')).toEqual([4]);
});

test('does not count marks that are no words', () => {
  expect(spokenLengths(['Wait — no.'], 'Wait —')).toEqual([4]);
});

test('skips words the text does not hold and keeps following', () => {
  expect(spokenLengths(['It is 5 now.'], 'It is five now')).toEqual([12]);
});

test('finds no word far beyond where the speech is', () => {
  const text = 'one two three four five six seven eight nine ten';
  expect(spokenLengths([text], 'one ten')).toEqual([3]);
});

test('carries on across the text parts of a reply', () => {
  expect(
    spokenLengths(['Let me look.', '— ', 'Found it.'], 'Let me look found'),
  ).toEqual([12, 2, 5]);
  expect(spokenLengths(['Let me look.', 'Found it.'], 'Let me')).toEqual([
    6, 0,
  ]);
});
