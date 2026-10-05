import { expect, test } from 'vitest';
import { SpaceGaps } from './space-gaps';

test('shows every index where it is while nothing was removed', () => {
  const gaps = new SpaceGaps();
  expect(gaps.shown(0)).toBe(0);
  expect(gaps.shown(2.5)).toBe(2.5);
});

test('keeps the place of removed workspaces free', () => {
  const gaps = new SpaceGaps();
  gaps.add(3);
  gaps.add(1);
  expect([0, 1, 2, 3].map((index) => gaps.shown(index))).toEqual([0, 2, 4, 5]);
});

test('closes the gaps and maps a shown position back', () => {
  const gaps = new SpaceGaps();
  gaps.add(1);
  gaps.add(3);
  const back = gaps.collapse();
  expect([0, 2, 3, 4, 5].map(back)).toEqual([0, 1, 2, 2, 3]);
  expect(gaps.shown(2)).toBe(2);
});
