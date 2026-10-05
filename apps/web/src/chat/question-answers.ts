import type { Question, QuestionItem } from '@/conversation/transcript';

export type Picks = Readonly<Record<string, readonly string[]>>;

export type Typed = Readonly<Record<string, string>>;

type Content = Record<string, string | string[]>;

function typedFor({ id, freeform }: QuestionItem, typed: Typed): string {
  return freeform ? (typed[id]?.trim() ?? '') : '';
}

function pickedFor({ id }: QuestionItem, picks: Picks): readonly string[] {
  return picks[id] ?? [];
}

export function isAnswered(
  questions: readonly QuestionItem[],
  picks: Picks,
  typed: Typed,
): boolean {
  return questions.every(
    (question) =>
      pickedFor(question, picks).length > 0 || typedFor(question, typed) !== '',
  );
}

function answerTo(question: QuestionItem, picks: Picks, typed: Typed): Content {
  const picked = pickedFor(question, picks);
  const text = typedFor(question, typed);
  return {
    ...(picked.length > 0 && {
      [question.id]: question.multiple ? [...picked] : picked[0],
    }),
    ...(text && { [String(question.freeform)]: text }),
  };
}

export function contentOf(
  questions: readonly QuestionItem[],
  picks: Picks,
  typed: Typed,
): Content {
  return Object.assign(
    {},
    ...questions.map((question) => answerTo(question, picks, typed)),
  );
}

function asList(answer: string | string[] | undefined): string[] {
  if (answer === undefined) return [];
  return Array.isArray(answer) ? answer : [answer];
}

export function chosenIn(
  { answers = {} }: Question,
  { id }: QuestionItem,
): string[] {
  return asList(answers[id]);
}

export function typedIn(
  { answers = {} }: Question,
  { freeform }: QuestionItem,
): string | undefined {
  const typed = freeform === null ? undefined : answers[freeform];
  return typeof typed === 'string' ? typed : undefined;
}
