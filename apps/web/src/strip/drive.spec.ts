import { motionValue } from 'motion/react';
import { expect, test } from 'vitest';
import { aim, drive, forget, StackMotion, targetOf } from './drive';
import { OVERVIEW, WORKSPACE } from './timings';

const TRANSITIONS = { workspace: WORKSPACE, overview: OVERVIEW };

function stack(): StackMotion {
  const motion = new StackMotion(TRANSITIONS);
  motion.apply({ renderIndex: 0, zoom: 1 }, 'jump');
  return motion;
}

function corrected(motion: StackMotion, zoom: number): boolean {
  motion.zoom.jump(zoom);
  return motion.shown() !== motion.renderIndex.get();
}

function zoomedOutToSecond(): StackMotion {
  const motion = stack();
  motion.apply({ renderIndex: 1, zoom: 0.5 }, 'animate');
  return motion;
}

test('stops an animation to follow a gesture', () => {
  const value = motionValue(0);
  drive(value, 100, 'animate', WORKSPACE);
  drive(value, 50, 'track', WORKSPACE);
  expect(value.isAnimating()).toBe(false);
  expect(value.get()).toBe(50);
});

test('leaves a value at rest on its target', () => {
  const value = motionValue(0);
  drive(value, 0, 'animate', WORKSPACE);
  expect(value.isAnimating()).toBe(false);
});

test('skips a target it was aimed at and takes it again once forgotten', () => {
  const value = motionValue(0);
  aim(value, 5);
  expect(targetOf(value)).toBe(5);
  drive(value, 5, 'jump', WORKSPACE);
  expect(value.get()).toBe(0);
  forget(value);
  drive(value, 5, 'jump', WORKSPACE);
  expect(value.get()).toBe(5);
});

test('jumps the zoom when the stack jumps', () => {
  const motion = stack();
  motion.apply({ renderIndex: 0, zoom: 0.5 }, 'jump');
  expect(motion.zoom.get()).toBe(0.5);
  expect(motion.zoom.isAnimating()).toBe(false);
});

test('aims at the new index when the workspaces are renumbered', () => {
  const motion = stack();
  motion.remap((index) => index + 1, 3);
  expect(motion.renderIndex.get()).toBe(1);
  expect(targetOf(motion.renderIndex)).toBe(3);
});

test('zooms and switches together so the slide never turns back', () => {
  const motion = zoomedOutToSecond();
  motion.zoom.jump(0.75);
  expect(motion.shown()).toBeCloseTo(-1 / 3, 6);
});

test.each([
  ['a switch alone', { renderIndex: 1, zoom: 1 }, 'animate'],
  ['a zoom alone', { renderIndex: 0, zoom: 0.5 }, 'animate'],
  ['a gesture', { renderIndex: 1, zoom: 0.5 }, 'track'],
] as const)('keeps the index uncorrected for %s', (_, target, mode) => {
  const motion = stack();
  motion.apply(target, mode);
  expect(corrected(motion, 0.75)).toBe(false);
});

test('needs a known zoom before it corrects the index', () => {
  const motion = new StackMotion(TRANSITIONS);
  motion.apply({ renderIndex: 1, zoom: 0.5 }, 'animate');
  expect(corrected(motion, 0.75)).toBe(false);
});

test('keeps the correction while nothing changes', () => {
  const motion = zoomedOutToSecond();
  motion.zoom.jump(0.75);
  motion.apply({ renderIndex: 1, zoom: 0.5 }, 'animate');
  motion.zoom.jump(0.6);
  expect(motion.shown()).toBeCloseTo(-0.4 / 0.6, 6);
});

test('drops the correction from where the index is shown on a new switch', () => {
  const motion = zoomedOutToSecond();
  motion.zoom.jump(0.75);
  motion.apply({ renderIndex: 2, zoom: 0.5 }, 'animate');
  expect(motion.renderIndex.get()).toBeCloseTo(-1 / 3, 6);
  expect(corrected(motion, 0.6)).toBe(false);
});

test('slides on to the corrected index when only the zoom changes', () => {
  const motion = zoomedOutToSecond();
  motion.zoom.jump(0.75);
  motion.apply({ renderIndex: 1, zoom: 1 }, 'animate');
  expect(motion.renderIndex.isAnimating()).toBe(true);
  expect(corrected(motion, 0.6)).toBe(false);
});
