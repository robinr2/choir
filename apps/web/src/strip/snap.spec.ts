import { expect, test } from 'vitest';
import { column, strip } from '@/test/fake-core';
import { snapView } from './snap';

const metrics = { width: 1000, height: 800, gap: 4 };

function columns(count: number, width = 0.5) {
  const all = Array.from({ length: count }, (_, index) =>
    column(`c${index}`, [`p${index}`], { width }),
  );
  return strip('w', all);
}

test('snaps to the closest column edge and focuses the furthest column that fits', () => {
  expect(snapView(columns(3), { current: 0, target: 100 }, metrics)).toEqual({
    column: 1,
    viewX: -4,
  });
  expect(snapView(columns(3), { current: 0, target: 300 }, metrics)).toEqual({
    column: 2,
    viewX: 494,
  });
});

test('focuses the furthest fitting column against the direction of a backward drag', () => {
  expect(snapView(columns(3), { current: 494, target: 300 }, metrics)).toEqual({
    column: 1,
    viewX: 494,
  });
});

test('prefers the left snap when two are equally close', () => {
  expect(snapView(columns(3), { current: 0, target: 245 }, metrics)).toEqual({
    column: 1,
    viewX: -4,
  });
});

test('snaps to edges between the first and the last column', () => {
  const thirds = columns(5, 1 / 3);
  expect(snapView(thirds, { current: 0, target: 300 }, metrics)).toEqual({
    column: 3,
    viewX: 328,
  });
  expect(snapView(thirds, { current: 400, target: 300 }, metrics)).toEqual({
    column: 1,
    viewX: 328,
  });
  expect(snapView(thirds, { current: 0, target: 900 }, metrics)).toEqual({
    column: 4,
    viewX: 660,
  });
  expect(snapView(thirds, { current: 900, target: -50 }, metrics)).toEqual({
    column: 0,
    viewX: -4,
  });
});

test('snaps a lone column to either edge of the view', () => {
  expect(snapView(columns(1), { current: 0, target: 10 }, metrics)).toEqual({
    column: 0,
    viewX: -4,
  });
  expect(snapView(columns(1), { current: 0, target: -400 }, metrics)).toEqual({
    column: 0,
    viewX: -502,
  });
});

function sized(widths: readonly number[]) {
  return strip(
    'w',
    widths.map((width, index) => column(`c${index}`, [`p${index}`], { width })),
  );
}

test('breaks ties between snaps towards the left', () => {
  expect(
    snapView(columns(5, 1 / 3), { current: 0, target: 494 }, metrics),
  ).toEqual({ column: 3, viewX: 328 });
});

test('counts the padding when checking which columns still fit', () => {
  expect(
    snapView(sized([0.5, 501 / 996]), { current: -20, target: -10 }, metrics),
  ).toEqual({ column: 0, viewX: -4 });
  const tight = sized([0.5, 499 / 996, 499 / 996]);
  expect(snapView(tight, { current: 600, target: 496 }, metrics)).toEqual({
    column: 2,
    viewX: 496,
  });
});

test('keeps a column wider than the view that its edge snapped to', () => {
  const wide = sized([0.5, 1.5, 0.5]);
  expect(snapView(wide, { current: 0, target: 500 }, metrics)).toEqual({
    column: 1,
    viewX: 498,
  });
  expect(snapView(wide, { current: 1000, target: 988 }, metrics)).toEqual({
    column: 1,
    viewX: 498,
  });
});

test('never snaps beyond the outer edges of the strip', () => {
  expect(snapView(columns(3), { current: 0, target: -400 }, metrics)).toEqual({
    column: 0,
    viewX: -4,
  });
});
