import { expect, test } from 'vitest';
import type { QuestionItem } from '@/conversation/transcript';
import { chosenIn, contentOf, isAnswered, typedIn } from './question-answers';

const COLOR: QuestionItem = {
  id: 'question_0',
  header: 'Color',
  prompt: 'Which color?',
  options: [
    { id: 'red', label: 'Red' },
    { id: 'blue', label: 'Blue' },
  ],
  multiple: false,
  freeform: 'question_0_custom',
};

const SIZES: QuestionItem = {
  id: 'question_1',
  header: 'Sizes',
  prompt: 'Which sizes?',
  options: [
    { id: 's', label: 'S' },
    { id: 'm', label: 'M' },
  ],
  multiple: true,
  freeform: null,
};

test('waits until every question has a pick or a typed answer', () => {
  expect(isAnswered([COLOR, SIZES], {}, {})).toBe(false);
  expect(isAnswered([COLOR, SIZES], { question_0: ['red'] }, {})).toBe(false);
  expect(
    isAnswered([COLOR, SIZES], { question_1: [] }, { question_0: '  ' }),
  ).toBe(false);
  expect(
    isAnswered(
      [COLOR, SIZES],
      { question_1: ['s'] },
      { question_0: 'green', question_1: 'x' },
    ),
  ).toBe(true);
  expect(isAnswered([SIZES], {}, { question_1: 'tiny' })).toBe(false);
});

test('answers single picks with an option, multiple ones with a list and typed ones under their own key', () => {
  expect(
    contentOf(
      [COLOR, SIZES],
      { question_0: ['blue'], question_1: ['s', 'm'] },
      { question_0: ' green ', question_1: 'ignored' },
    ),
  ).toStrictEqual({
    question_0: 'blue',
    question_0_custom: 'green',
    question_1: ['s', 'm'],
  });
  expect(contentOf([COLOR], {}, { question_0: 'green' })).toStrictEqual({
    question_0_custom: 'green',
  });
  expect(contentOf([COLOR], { question_0: ['red'] }, {})).toStrictEqual({
    question_0: 'red',
  });
});

test('reads the answers a question settled with', () => {
  const answers = {
    question_0: 'red',
    question_0_custom: 'green',
    question_1: ['s'],
  };
  const question = { id: 'i1', questions: [COLOR, SIZES], answers };
  expect(chosenIn(question, COLOR)).toEqual(['red']);
  expect(chosenIn(question, SIZES)).toEqual(['s']);
  expect(typedIn(question, COLOR)).toBe('green');
  expect(typedIn(question, SIZES)).toBeUndefined();
  const declined = {
    id: 'i1',
    questions: [COLOR],
    resolution: 'declined' as const,
  };
  expect(chosenIn(declined, COLOR)).toEqual([]);
  expect(typedIn(declined, COLOR)).toBeUndefined();
  const listed = { ...question, answers: { question_0_custom: ['x'] } };
  expect(typedIn(listed, COLOR)).toBeUndefined();
});
