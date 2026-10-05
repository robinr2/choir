import { expect, test } from 'vitest';
import {
  CLOSE,
  MOVE,
  OPEN,
  OVERVIEW,
  RESIZE,
  SHEET,
  VIEW,
  WORKSPACE,
} from './timings';

test('uses critically damped springs with niri stiffness', () => {
  expect(WORKSPACE).toMatchObject({ stiffness: 1000, mass: 1 });
  expect(WORKSPACE.damping).toBeCloseTo(63.246, 3);
  for (const spring of [VIEW, MOVE, RESIZE, OVERVIEW, SHEET]) {
    expect(spring).toMatchObject({ type: 'spring', stiffness: 800, mass: 1 });
    expect(spring.damping).toBeCloseTo(56.569, 3);
  }
});

test('opens with ease-out-expo and closes with ease-out-quad in 150 ms', () => {
  expect(OPEN.duration).toBe(0.15);
  expect(CLOSE.duration).toBe(0.15);
  expect([OPEN.ease(0), OPEN.ease(0.5), OPEN.ease(1)]).toEqual([
    0,
    1 - 2 ** -5,
    1,
  ]);
  expect([CLOSE.ease(0), CLOSE.ease(0.5), CLOSE.ease(1)]).toEqual([0, 0.75, 1]);
});
