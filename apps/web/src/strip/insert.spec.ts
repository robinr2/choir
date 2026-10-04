import { expect, test } from 'vitest';
import { column, strip } from '@/test/fake-core';
import { hintRect, insertPosition } from './insert';

const metrics = { width: 1000, height: 800, gap: 4 };

const shown = {
  layout: strip('w', [column('a', ['p']), column('b', ['q', 'r'])]),
  viewX: -4,
};

const empty = { layout: strip('w', []), viewX: 250 };

function at(x: number, y: number) {
  return insertPosition(shown, { x, y }, metrics);
}

test('puts a pane on an empty workspace into the first column', () => {
  expect(insertPosition(empty, { x: 500, y: 300 }, metrics)).toEqual({
    column: 0,
  });
});

test('picks a new column before everything left of the strip', () => {
  expect(at(1, 300)).toEqual({ column: 0 });
});

test('picks the gap between columns when it is closer than a gap between panes', () => {
  expect(at(500, 300)).toEqual({ column: 1 });
  expect(at(1100, 300)).toEqual({ column: 2 });
});

test('picks a place inside a column when the gap between panes is closer', () => {
  expect(at(700, 400)).toEqual({ column: 1, tile: 1 });
  expect(at(100, 10)).toEqual({ column: 0, tile: 0 });
  expect(at(700, 797)).toEqual({ column: 1, tile: 2 });
});

test('aims for the middle of the gaps', () => {
  expect(at(252, 400)).toEqual({ column: 1 });
  expect(at(248, 400)).toEqual({ column: 0 });
  expect(at(700, 600)).toEqual({ column: 1, tile: 2 });
  expect(at(700, 596)).toEqual({ column: 1, tile: 1 });
  expect(at(600, 500)).toEqual({ column: 1 });
  expect(at(500, 10)).toEqual({ column: 1 });
});

function newColumn(index: number) {
  return hintRect(shown, { column: index }, metrics);
}

function inSecond(tile: number) {
  return hintRect(shown, { column: 1, tile }, metrics);
}

test('hints a new column as a strip between, before or after the columns', () => {
  expect(newColumn(0)).toEqual({ x: -300, y: 4, width: 300, height: 792 });
  expect(newColumn(1)).toEqual({ x: 350, y: 4, width: 300, height: 792 });
  expect(newColumn(2)).toEqual({ x: 1000, y: 4, width: 300, height: 792 });
  expect(hintRect(empty, { column: 0 }, metrics)).toEqual({
    x: 4,
    y: 4,
    width: 300,
    height: 792,
  });
});

test('moves the hint with the view', () => {
  const scrolled = { ...shown, viewX: 100 };
  expect(hintRect(scrolled, { column: 1 }, metrics).x).toBe(246);
  expect(hintRect(scrolled, { column: 1, tile: 0 }, metrics).x).toBe(398);
});

test('hints a place in a column at its top, bottom or between panes', () => {
  expect(inSecond(0)).toEqual({ x: 502, y: 4, width: 494, height: 150 });
  expect(inSecond(1)).toEqual({ x: 502, y: 250, width: 494, height: 300 });
  expect(inSecond(2)).toEqual({ x: 502, y: 646, width: 494, height: 150 });
});
