import { expect, test } from 'vitest';
import { column, strip } from '@/test/fake-core';
import { fitActive, fitView, padding } from './fit';
import { activeX } from './geometry';

const metrics = { width: 1000, height: 800, gap: 4 };

test('pads a column by the gap, or less when it barely fits', () => {
  expect(padding(500, metrics)).toBe(4);
  expect(padding(994, metrics)).toBe(3);
  expect(padding(1200, metrics)).toBe(0);
});

test('leaves the view where it is while the column is fully visible', () => {
  expect(fitView(-4, [0, 494], metrics)).toBe(-4);
  expect(fitView(-200, [0, 494], metrics)).toBe(-200);
  expect(fitView(-502, [0, 494], metrics)).toBe(-502);
  expect(fitView(-503, [0, 494], metrics)).toBe(-502);
  expect(fitView(-3, [0, 494], metrics)).toBe(-4);
});

test('scrolls the shortest way to show the whole column', () => {
  expect(fitView(0, [996, 494], metrics)).toBe(494);
  expect(fitView(996, [0, 494], metrics)).toBe(-4);
  expect(fitView(50, [0, 992], metrics)).toBe(-4);
  expect(fitView(-60, [0, 992], metrics)).toBe(-4);
  expect(fitView(0, [0, 994], metrics)).toBe(-3);
});

test('aligns a column wider than the view to its left edge', () => {
  expect(fitView(300, [100, 1000], metrics)).toBe(100);
  expect(fitView(300, [100, 1400], metrics)).toBe(100);
  expect(fitView(900, [100, 1400], metrics)).toBe(100);
});

test('fits the active column of a strip', () => {
  const layout = strip('w', [column('a', ['p']), column('b', ['q'])], {
    activeColumn: 1,
  });
  expect(activeX(layout, metrics)).toBe(498);
  expect(fitActive(layout, 0, metrics)).toBe(0);
  expect(fitActive(layout, 600, metrics)).toBe(494);
  expect(fitActive(strip('w', []), 37, metrics)).toBe(37);
});
