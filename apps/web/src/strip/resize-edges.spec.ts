import { expect, test } from 'vitest';
import {
  cursorFor,
  DoubleClicks,
  edgesAt,
  horizontal,
  vertical,
} from './resize-edges';

const rect = { x: 100, y: 100, width: 300, height: 600 };

const none = { left: false, right: false, top: false, bottom: false };

test('picks the edges by the thirds of the pane under the pointer', () => {
  expect(edgesAt(rect, 199, 299)).toEqual({ ...none, left: true, top: true });
  expect(edgesAt(rect, 200, 300)).toEqual(none);
  expect(edgesAt(rect, 300, 500)).toEqual(none);
  expect(edgesAt(rect, 301, 501)).toEqual({
    ...none,
    right: true,
    bottom: true,
  });
});

test('tells horizontal from vertical edges', () => {
  expect(horizontal({ ...none, left: true })).toBe(true);
  expect(horizontal({ ...none, right: true })).toBe(true);
  expect(horizontal({ ...none, top: true })).toBe(false);
  expect(vertical({ ...none, top: true })).toBe(true);
  expect(vertical({ ...none, bottom: true })).toBe(true);
  expect(vertical({ ...none, left: true })).toBe(false);
});

test('shows a resize cursor for the edges', () => {
  expect(cursorFor({ ...none, left: true })).toBe('w-resize');
  expect(cursorFor({ ...none, right: true })).toBe('e-resize');
  expect(cursorFor({ ...none, top: true })).toBe('n-resize');
  expect(cursorFor({ ...none, bottom: true, left: true })).toBe('sw-resize');
  expect(cursorFor({ ...none, top: true, right: true })).toBe('ne-resize');
});

test('spots a second press on the same pane within 400 ms', () => {
  const clicks = new DoubleClicks();
  const left = { ...none, left: true, top: true };
  expect(clicks.repeated({ paneId: 'a', time: 0, edges: left })).toBeNull();
  expect(
    clicks.repeated({ paneId: 'a', time: 400, edges: { ...none, left: true } }),
  ).toEqual({ ...none, left: true });
  expect(clicks.repeated({ paneId: 'a', time: 500, edges: left })).toBeNull();
  expect(clicks.repeated({ paneId: 'a', time: 901, edges: left })).toBeNull();
  expect(clicks.repeated({ paneId: 'b', time: 950, edges: left })).toBeNull();
  expect(
    clicks.repeated({ paneId: 'b', time: 955, edges: { ...none, top: true } }),
  ).toEqual({ ...none, top: true });
  expect(clicks.repeated({ paneId: 'b', time: 957, edges: left })).toBeNull();
  const corner = { left: true, right: true, top: true, bottom: true };
  expect(clicks.repeated({ paneId: 'b', time: 960, edges: corner })).toEqual(
    left,
  );
  expect(
    clicks.repeated({
      paneId: 'b',
      time: 970,
      edges: { ...none, right: true, bottom: true },
    }),
  ).toBeNull();
});
