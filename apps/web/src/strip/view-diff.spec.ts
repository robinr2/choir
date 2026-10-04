import { expect, test } from 'vitest';
import { column, strip } from '@/test/fake-core';
import type { StripLayout } from '@/workspace/core-workspace';
import type { StripView } from './types';
import { viewXOf } from './geometry';
import { fitted, nextStripView, refitted } from './view-diff';

const metrics = { width: 1000, height: 800, gap: 4 };

function layout(
  ids: string,
  activeColumn: number,
  restoresPrevious = false,
): StripLayout {
  const columns = ids.split('').map((id) => column(id, [`pane-${id}`]));
  return strip('w', columns, { activeColumn, restoresPrevious });
}

function view(before: StripLayout, offset: number, saved = 0): StripView {
  return { layout: before, offset, saved };
}

function offsetAfter(prev: StripView | undefined, after: StripLayout) {
  return nextStripView(prev, after, metrics).offset;
}

test('shows a strip it sees for the first time from its active column', () => {
  expect(offsetAfter(undefined, layout('ab', 0))).toBe(-4);
  expect(offsetAfter(undefined, layout('abc', 2))).toBe(-4);
  expect(nextStripView(undefined, layout('a', 0), metrics).saved).toBe(0);
});

test('starts afresh once an empty strip gets its first column', () => {
  const empty = view(strip('w', []), 300, 7);
  expect(nextStripView(empty, layout('a', 0), metrics)).toEqual({
    layout: layout('a', 0),
    offset: -4,
    saved: 7,
  });
});

test('keeps the view while focus moves to a visible column', () => {
  expect(offsetAfter(view(layout('abc', 0), -4), layout('abc', 1))).toBe(-502);
});

test('scrolls the shortest way when focus moves to a hidden column', () => {
  expect(offsetAfter(view(layout('abc', 0), -4), layout('abc', 2))).toBe(-502);
  expect(offsetAfter(view(layout('abc', 2), -502), layout('abc', 0))).toBe(-4);
});

test('keeps the active column in place when a column left of it goes', () => {
  const after = nextStripView(
    view(layout('abc', 2), -502),
    layout('bc', 1),
    metrics,
  );
  expect(after.offset).toBe(-502);
  expect(viewXOf(after, metrics)).toBe(-4);
});

test('keeps the active column in place when a column left of it changes width', () => {
  const before = strip(
    'w',
    [column('a', ['p'], { width: 0.3 }), column('b', ['q'])],
    {
      activeColumn: 1,
    },
  );
  const after = strip('w', [column('a', ['p']), column('b', ['q'])], {
    activeColumn: 1,
  });
  expect(offsetAfter(view(before, -100), after)).toBe(-100);
});

test('keeps the active column in place when its width changes', () => {
  const wider = strip('w', [column('a', ['p'], { width: 0.7 })]);
  expect(offsetAfter(view(layout('a', 0), -4), wider)).toBe(-4);
});

test('keeps the view when the active column moves and still fits', () => {
  expect(offsetAfter(view(layout('ab', 0), -4), layout('ba', 1))).toBe(-502);
  expect(offsetAfter(view(layout('abc', 2), -502), layout('acb', 1))).toBe(-4);
});

test('lets the column that takes the place of the closed one keep its spot', () => {
  expect(offsetAfter(view(layout('abc', 1), -502), layout('ac', 1))).toBe(-502);
  expect(offsetAfter(view(layout('abc', 0), -4), layout('bc', 0))).toBe(-4);
});

test('measures from the end when the last column closes', () => {
  expect(offsetAfter(view(layout('ab', 1), -502), layout('a', 0))).toBe(-4);
  expect(offsetAfter(view(layout('abc', 2), -502), layout('ab', 1))).toBe(-4);
});

test('returns to the previous column and its view when the opened one closes', () => {
  const opened = view(layout('ab', 1, true), -502, -100);
  expect(offsetAfter(opened, layout('a', 0))).toBe(-100);
});

test('restores only after a fresh open, with the old column focused again', () => {
  const plain = view(layout('ab', 1), -502, -100);
  expect(offsetAfter(plain, layout('a', 0))).toBe(-4);
  const focusedBack = view(layout('ab', 1, true), -502, -100);
  expect(offsetAfter(focusedBack, layout('ab', 0))).toBe(-4);
  const otherClosed = view(layout('abc', 1, true), -502, -100);
  expect(offsetAfter(otherClosed, layout('ac', 1))).toBe(-502);
});

function opening(prev: StripView, after: StripLayout) {
  return nextStripView(prev, after, metrics).saved;
}

test('remembers the view of the column focused before a new one opened', () => {
  expect(opening(view(layout('a', 0), -40, 9), layout('ab', 1, true))).toBe(
    -40,
  );
  expect(
    opening(view(layout('ab', 1, true), -40, 9), layout('abc', 2, true)),
  ).toBe(-40);
  expect(
    opening(view(layout('ab', 1, true), -40, 9), layout('ab', 1, true)),
  ).toBe(9);
  expect(opening(view(layout('ab', 0), -40, 9), layout('ab', 1))).toBe(9);
});

test('fits a strip at a given view position', () => {
  expect(fitted(layout('ab', 1), 600, 3, metrics)).toEqual({
    layout: layout('ab', 1),
    offset: -4,
    saved: 3,
  });
});

test('fits the active column again when the strip changes size', () => {
  const wide = { width: 2000, height: 800, gap: 4 };
  const prev = view(layout('abc', 2), -502, 5);
  expect(refitted(prev, metrics)).toEqual(prev);
  expect(refitted(prev, wide).offset).toBe(-502);
  expect(refitted(view(layout('abc', 0), 0), metrics).offset).toBe(-4);
});
