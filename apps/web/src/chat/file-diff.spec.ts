import { expect, test } from 'vitest';
import { shownDiff, shownPath } from './file-diff';

test('shows the changed lines of a file with three lines of context', () => {
  const oldText = 'a\nb\nc\nd\ne\nf\ng\nh\ni\n';
  const newText = 'a\nB\nc\nd\ne\nf\ng\nh\nI\nj\n';
  expect(shownDiff({ path: '/x', oldText, newText }, 'x')).toEqual({
    filename: 'x',
    additions: 3,
    deletions: 2,
    lines: [
      { kind: 'context', text: '@@ -1,9 +1,10 @@' },
      { kind: 'context', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'B' },
      { kind: 'context', text: 'c' },
      { kind: 'context', text: 'd' },
      { kind: 'context', text: 'e' },
      { kind: 'context', text: 'f' },
      { kind: 'context', text: 'g' },
      { kind: 'context', text: 'h' },
      { kind: 'removed', text: 'i' },
      { kind: 'added', text: 'I' },
      { kind: 'added', text: 'j' },
    ],
  });
});

test('splits distant changes into hunks and drops patch notes', () => {
  const old = Array.from({ length: 20 }, (_, index) => `${index}`);
  const changed = old.with(1, 'one').with(18, 'eighteen');
  const { lines } = shownDiff(
    { path: '/x', oldText: old.join('\n'), newText: changed.join('\n') },
    'x',
  );
  expect(lines.filter(({ text }) => text.startsWith('@@'))).toEqual([
    { kind: 'context', text: '@@ -1,6 +1,6 @@' },
    { kind: 'context', text: '@@ -15,6 +15,6 @@' },
  ]);
  expect(lines.some(({ text }) => text.includes('No newline'))).toBe(false);
});

test('shows a new file as added lines only', () => {
  expect(
    shownDiff({ path: '/x', oldText: null, newText: 'one\ntwo\n' }, 'x'),
  ).toEqual({
    filename: 'x',
    additions: 2,
    deletions: 0,
    lines: [
      { kind: 'added', text: 'one' },
      { kind: 'added', text: 'two' },
    ],
  });
});

test('shows paths inside the session folder relative to it', () => {
  expect(shownPath('/work/src/a.ts', '/work')).toBe('src/a.ts');
  expect(shownPath('/workshop/a.ts', '/work')).toBe('/workshop/a.ts');
  expect(shownPath('/work/a.ts', undefined)).toBe('/work/a.ts');
  expect(shownPath('/work/a.ts', '')).toBe('/work/a.ts');
});
