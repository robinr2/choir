import { expect, test } from 'vitest';
import { band, bandClamp } from './rubber-band';
import { ScrollTracker } from './scroll-tracker';
import { SwipeTracker } from './swipe-tracker';

test('pulls a rubber band less the further it stretches', () => {
  const rubber = { stiffness: 1, limit: 0.5 };
  expect(band(rubber, 0)).toBe(0);
  expect(band(rubber, 0.5)).toBe(0.25);
  expect(band(rubber, 1.5)).toBe(0.375);
  expect(band({ stiffness: 0.5, limit: 0.05 }, 0.1)).toBeCloseTo(0.025);
});

test('clamps with a rubber band beyond the bounds', () => {
  const rubber = { stiffness: 1, limit: 0.5 };
  expect(bandClamp(rubber, [0, 2], 1.2)).toBe(1.2);
  expect(bandClamp(rubber, [0, 2], 2.5)).toBe(2.25);
  expect(bandClamp(rubber, [0, 2], -0.5)).toBe(-0.25);
  expect(bandClamp(rubber, [0, 2], 2)).toBe(2);
});

test('tracks the position and recent velocity of a swipe', () => {
  const tracker = new SwipeTracker();
  expect(tracker.velocity()).toBe(0);
  tracker.push(10, 1000);
  expect(tracker.velocity()).toBe(0);
  tracker.push(20, 1100);
  tracker.push(30, 1200);
  expect(tracker.pos).toBe(60);
  expect(tracker.velocity()).toBe(500);
  tracker.push(-5, 1150);
  expect(tracker.pos).toBe(60);
  tracker.push(0, 1350);
  expect(tracker.velocity()).toBe(200);
  expect(tracker.projectedEndPos()).toBeCloseTo(60 + 200 / 3.0045, 1);
});

test('ignores late events and takes the newest ones for the velocity', () => {
  const tracker = new SwipeTracker();
  tracker.push(10, 1000);
  tracker.push(10, 1050);
  tracker.push(10, 1050);
  tracker.push(10, 1100);
  tracker.push(10, 1075);
  expect(tracker.pos).toBe(40);
  expect(tracker.velocity()).toBe(400);
});

test('counts wheel ticks and starts over when the direction changes', () => {
  const tracker = new ScrollTracker(120);
  expect(tracker.accumulate(60)).toBe(0);
  expect(tracker.accumulate(60)).toBe(1);
  expect(tracker.accumulate(250)).toBe(2);
  expect(tracker.accumulate(-50)).toBeCloseTo(0);
  expect(tracker.accumulate(-70)).toBe(-1);
  expect(tracker.accumulate(-119)).toBeCloseTo(0);
  expect(tracker.accumulate(-1)).toBe(-1);
});
