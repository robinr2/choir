import { expect, test } from 'vitest';
import { elapsed, shortId, shownStatus } from './agent-status';

test('tells how long the agent has been at it', () => {
  expect(elapsed(1000, 1000)).toBe('0:00');
  expect(elapsed(1000, 900)).toBe('0:00');
  expect(elapsed(0, 65_999)).toBe('1:05');
  expect(elapsed(0, 3_599_000)).toBe('59:59');
  expect(elapsed(0, 3_600_000)).toBe('1:00:00');
  expect(elapsed(0, 7_384_000)).toBe('2:03:04');
});

test('shortens a session id to its first eight characters', () => {
  expect(shortId('0b6f2c9e-3f5d-4a8e')).toBe('0b6f2c9e');
});

test('shows each conversation status as an agent state', () => {
  expect(shownStatus('starting')).toEqual({
    state: 'working',
    label: 'Starting',
    ticks: false,
  });
  expect(shownStatus('working')).toEqual({
    state: 'working',
    label: 'Working',
    ticks: true,
  });
  expect(shownStatus('waiting')).toEqual({
    state: 'waiting',
    label: 'Waiting for you',
    ticks: true,
  });
  expect(shownStatus('idle')).toEqual({
    state: 'done',
    label: 'Done',
    ticks: false,
  });
  expect(shownStatus('failed')).toEqual({
    state: 'failed',
    label: 'Failed',
    ticks: false,
  });
});
