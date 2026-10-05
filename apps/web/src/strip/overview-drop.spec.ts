import { expect, test } from 'vitest';
import { scrollFactor } from './overview-drop';

const STACK = {
  metrics: { width: 1000, height: 800, gap: 4 },
  renderIndex: 0,
  zoom: 0.5,
  count: 2,
};

test('scrolls the workspaces near the top and bottom edges of their strip', () => {
  expect(scrollFactor(STACK, { x: 500, y: 0 })).toBe(-1);
  expect(scrollFactor(STACK, { x: 500, y: 25 })).toBe(-0.5);
  expect(scrollFactor(STACK, { x: 500, y: 400 })).toBe(0);
  expect(scrollFactor(STACK, { x: 500, y: 775 })).toBe(0.5);
  expect(scrollFactor(STACK, { x: 500, y: 900 })).toBe(1);
});

test('leaves the workspaces still beside their strip or without height', () => {
  expect(scrollFactor(STACK, { x: 249, y: 0 })).toBe(0);
  expect(scrollFactor(STACK, { x: 750, y: 0 })).toBe(0);
  expect(scrollFactor(STACK, { x: 250, y: 0 })).toBe(-1);
  const flat = { ...STACK, metrics: { ...STACK.metrics, height: 0 } };
  expect(scrollFactor(flat, { x: 500, y: 0 })).toBe(0);
});
