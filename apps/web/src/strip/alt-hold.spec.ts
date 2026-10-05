import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AltHold, HOLD_DELAY } from './alt-hold';

let shown: boolean[];
let hold: AltHold;
let stop: () => void;

function key(type: string, init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent(type, init));
}

function pressAlt(init: KeyboardEventInit = {}) {
  key('keydown', { key: 'Alt', code: 'AltLeft', altKey: true, ...init });
}

beforeEach(() => {
  vi.useFakeTimers();
  shown = [];
  hold = new AltHold((visible) => shown.push(visible));
  stop = hold.subscribe(window);
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

test('shows after Alt is held on its own for a moment', () => {
  pressAlt();
  vi.advanceTimersByTime(HOLD_DELAY - 1);
  expect(shown).toEqual([]);
  vi.advanceTimersByTime(1);
  expect(shown).toEqual([true]);
});

test('waits about half a second', () => {
  expect(HOLD_DELAY).toBe(500);
});

test('keeps waiting through the repeats of a held Alt', () => {
  pressAlt();
  vi.advanceTimersByTime(HOLD_DELAY / 2);
  pressAlt({ repeat: true });
  vi.advanceTimersByTime(HOLD_DELAY / 2);
  expect(shown).toEqual([true]);
});

test('never shows when another key joins Alt in time', () => {
  pressAlt();
  key('keydown', { key: 'j', code: 'KeyJ', altKey: true });
  vi.advanceTimersByTime(HOLD_DELAY * 2);
  expect(shown).toEqual([]);
});

test('ignores Alt pressed together with another modifier', () => {
  pressAlt({ ctrlKey: true });
  vi.advanceTimersByTime(HOLD_DELAY * 2);
  expect(shown).toEqual([]);
});

test.each([
  ['another key', () => key('keydown', { key: 'j', code: 'KeyJ' })],
  ['releasing Alt', () => key('keyup', { key: 'Alt', code: 'AltLeft' })],
  ['a click', () => window.dispatchEvent(new PointerEvent('pointerdown'))],
  ['scrolling', () => window.dispatchEvent(new WheelEvent('wheel'))],
  ['leaving the window', () => window.dispatchEvent(new FocusEvent('blur'))],
])('hides on %s', (_, act) => {
  pressAlt();
  vi.advanceTimersByTime(HOLD_DELAY);
  act();
  expect(shown).toEqual([true, false]);
});

test('reports nothing when a dismissal changes nothing', () => {
  window.dispatchEvent(new PointerEvent('pointerdown'));
  key('keyup', { key: 'Alt', code: 'AltLeft' });
  expect(shown).toEqual([]);
});

test('stops listening once stopped', () => {
  stop();
  pressAlt();
  vi.advanceTimersByTime(HOLD_DELAY);
  expect(shown).toEqual([]);
});

test('forgets a pending show when stopped', () => {
  pressAlt();
  stop();
  vi.advanceTimersByTime(HOLD_DELAY);
  expect(shown).toEqual([]);
});
