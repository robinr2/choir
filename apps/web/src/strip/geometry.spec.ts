import { expect, test } from 'vitest';
import { column } from '@/test/fake-core';
import {
  columnWidth,
  columnXs,
  MIN_HEIGHT,
  MIN_WIDTH,
  proportionOf,
  tileHeights,
  tileYs,
} from './geometry';

const metrics = { width: 1000, height: 800, gap: 4 };

test('sizes a column from its proportion of the strip minus the gaps', () => {
  expect(columnWidth(column('a', []), metrics)).toBe(494);
  expect(columnWidth(column('a', [], { width: 1 / 3 }), metrics)).toBe(328);
  expect(columnWidth(column('a', [], { fullWidth: true }), metrics)).toBe(992);
  expect(columnWidth(column('a', [], { width: 0.05 }), metrics)).toBe(
    MIN_WIDTH,
  );
  expect(proportionOf(column('a', [], { width: 0.3 }))).toBe(0.3);
  expect(proportionOf(column('a', [], { width: 0.3, fullWidth: true }))).toBe(
    1,
  );
});

test('places columns one after another with a gap between them', () => {
  const half = column('a', []);
  const full = column('b', [], { fullWidth: true });
  expect(columnXs([], metrics)).toEqual([0]);
  expect(columnXs([half, full, half], metrics)).toEqual([0, 498, 1494, 1992]);
});

test('gives a lone pane the whole height between the gaps', () => {
  expect(tileHeights([{ auto: 1 }], metrics)).toEqual([792]);
  expect(tileHeights([{ auto: 5 }], metrics)).toEqual([792]);
});

test('shares the height between auto panes by their weights', () => {
  expect(tileHeights([{ auto: 1 }, { auto: 1 }], metrics)).toEqual([394, 394]);
  expect(tileHeights([{ auto: 1 }, { auto: 3 }], metrics)).toEqual([195, 593]);
});

test('gives a fixed pane its proportion and the auto panes the rest', () => {
  expect(tileHeights([{ fixed: 0.5 }, { auto: 1 }], metrics)).toEqual([
    394, 394,
  ]);
  expect(tileHeights([{ auto: 1 }, { fixed: 0.25 }], metrics)).toEqual([
    593, 195,
  ]);
  expect(tileHeights([{ fixed: 0.5 }], metrics)).toEqual([394]);
});

test('keeps every pane at least as tall as its title bar', () => {
  expect(tileHeights([{ fixed: 0 }], metrics)).toEqual([MIN_HEIGHT]);
  expect(
    tileHeights([{ fixed: 1 }, { auto: 1 }, { auto: 1 }], metrics),
  ).toEqual([704, MIN_HEIGHT, MIN_HEIGHT]);
  expect(tileHeights([{ fixed: 2 }], metrics)).toEqual([792]);
  expect(tileHeights([{ auto: 1 }, { auto: 100 }], metrics)).toEqual([
    MIN_HEIGHT,
    748,
  ]);
  expect(tileHeights([{ auto: 100 }, { auto: 1 }], metrics)).toEqual([
    748,
    MIN_HEIGHT,
  ]);
});

test('stacks panes from the top gap down', () => {
  expect(tileYs([], 4)).toEqual([4]);
  expect(tileYs([100, 200], 4)).toEqual([4, 108, 312]);
});
