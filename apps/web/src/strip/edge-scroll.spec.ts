import { expect, test } from 'vitest';
import { column, strip } from '@/test/fake-core';
import { clampView, EdgeScroll, edgeFactor } from './edge-scroll';

const metrics = { width: 1000, height: 800, gap: 4 };

test('scrolls faster the closer the pointer gets to an edge', () => {
  expect(edgeFactor(500, 1000)).toBe(0);
  expect(edgeFactor(30, 1000)).toBe(0);
  expect(edgeFactor(15, 1000)).toBe(-0.5);
  expect(edgeFactor(-40, 1000)).toBe(-1);
  expect(edgeFactor(970, 1000)).toBe(0);
  expect(edgeFactor(985, 1000)).toBe(0.5);
  expect(edgeFactor(1200, 1000)).toBe(1);
  expect(edgeFactor(5, 20)).toBe(-0.5);
  expect(edgeFactor(0, 0.01)).toBe(0);
  expect(edgeFactor(0, 0.02)).toBe(-1);
  expect(edgeFactor(10, 20)).toBe(0);
});

test('waits a moment at the edge, then scrolls with the elapsed time', () => {
  const scroll = new EdgeScroll();
  expect(scroll.step(1, 1000)).toBe(0);
  expect(scroll.step(1, 1050)).toBe(0);
  expect(scroll.step(1, 1100)).toBe(75);
  expect(scroll.step(-0.5, 1120)).toBe(-15);
  expect(scroll.step(0, 1200)).toBe(0);
  expect(scroll.step(1, 1250)).toBe(0);
  expect(scroll.step(1, 1360)).toBe(165);
});

test('keeps the view near the columns while scrolling', () => {
  const layout = strip('w', [column('a', ['p']), column('b', ['q'])]);
  expect(clampView(layout, 300, metrics)).toBe(300);
  expect(clampView(layout, 2000, metrics)).toBe(992);
  expect(clampView(layout, -2000, metrics)).toBe(-1000);
  expect(clampView(strip('w', []), 300, metrics)).toBe(0);
  const wide = { ...metrics, width: 3000 };
  expect(clampView(layout, -5000, wide)).toBe(-3000);
  expect(clampView(layout, 5000, wide)).toBe(2992);
});
