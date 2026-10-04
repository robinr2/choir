import { newColumn } from './column.js';
import {
  activateColumn,
  activeColumn,
  addColumn,
  addPane,
  addTileToColumn,
  emptySpace,
  isEmpty,
  placeOf,
  removeColumnAt,
  removeTile,
  updateActive,
} from './scrolling.js';
import { sketch, space } from '../test/sketch.js';
import type { Space } from './layout.schemas.js';

const HALF = { width: 0.5, fullWidth: false };

function opened(base: Space, paneId: string, index?: number): Space {
  return addPane(base, paneId, { index, size: HALF });
}

it('starts empty with its own id', () => {
  const first = emptySpace();
  expect(first).toEqual({
    id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    columns: [],
    activeColumn: 0,
    restoresPrevious: false,
  });
  expect(isEmpty(first)).toBe(true);
  expect(emptySpace().id).not.toBe(first.id);
});

it('finds panes and the active column', () => {
  const strip = space('A | B C* | D');
  expect(isEmpty(strip)).toBe(false);
  expect(activeColumn(strip).tiles[0].paneId).toBe('B');
  expect(placeOf(strip, 'C')).toEqual({ column: 1, tile: 1 });
  expect(placeOf(strip, 'D')).toEqual({ column: 2, tile: 0 });
  expect(placeOf(strip, 'X')).toBeUndefined();
});

describe('activateColumn', () => {
  it('forgets the column to go back to when focus moves', () => {
    const moved = activateColumn(space('A | B*', true), 0);
    expect([sketch(moved), moved.restoresPrevious]).toEqual(['A* | B', false]);
  });

  it('keeps everything when the column is already active', () => {
    const strip = space('A | B*', true);
    expect(activateColumn(strip, 1)).toBe(strip);
  });
});

it('leaves an empty workspace alone when changing the active column', () => {
  const empty = space('');
  expect(updateActive(empty, () => newColumn('X', HALF))).toBe(empty);
});

describe('adding a column', () => {
  it('opens the first column at the start and focuses it', () => {
    const first = opened(space(''), 'A');
    expect([sketch(first), first.restoresPrevious]).toEqual(['A*', false]);
  });

  it('opens right after the focused column and remembers to come back', () => {
    const added = opened(space('A* | B'), 'C');
    expect([sketch(added), added.restoresPrevious]).toEqual([
      'A | C* | B',
      true,
    ]);
  });

  it('does not remember to come back for a column added elsewhere', () => {
    const before = opened(space('A | B*'), 'C', 0);
    expect([sketch(before), before.restoresPrevious]).toEqual([
      'C* | A | B',
      false,
    ]);
    const after = opened(space('A* | B | D'), 'C', 3);
    expect([sketch(after), after.restoresPrevious]).toEqual([
      'A | B | D | C*',
      false,
    ]);
  });

  it('keeps focus on its column when adding without focusing', () => {
    const left = addColumn(space('A | B*', true), newColumn('C', HALF), {
      index: 1,
      activate: false,
    });
    expect([sketch(left), left.restoresPrevious]).toEqual(['A | C | B*', true]);
    const right = addColumn(space('A* | B'), newColumn('C', HALF), {
      index: 2,
      activate: false,
    });
    expect(sketch(right)).toBe('A* | B | C');
  });

  it('gives the new column the given size', () => {
    const wide = addPane(space('A*'), 'B', {
      size: { width: 0.8, fullWidth: true },
    });
    expect(activeColumn(wide)).toMatchObject({ width: 0.8, fullWidth: true });
  });
});

describe('removing a column', () => {
  it('focuses the column that takes its place from the right', () => {
    const removed = removeColumnAt(space('A | B* | C'), 1);
    expect([sketch(removed), removed.restoresPrevious]).toEqual([
      'A | C*',
      false,
    ]);
  });

  it('focuses the column on the left when the last column goes', () => {
    expect(sketch(removeColumnAt(space('A | B*'), 1))).toBe('A*');
  });

  it('goes back to the column it was opened from', () => {
    const removed = removeColumnAt(space('A | B* | C', true), 1);
    expect([sketch(removed), removed.restoresPrevious]).toEqual([
      'A* | C',
      false,
    ]);
  });

  it('keeps the focused column when another one goes', () => {
    const left = removeColumnAt(space('A | B | C*', true), 0);
    expect([sketch(left), left.restoresPrevious]).toEqual(['B | C*', false]);
    expect(sketch(removeColumnAt(space('A | B* | C'), 0))).toBe('B* | C');
    const right = removeColumnAt(space('A | B* | C', true), 2);
    expect([sketch(right), right.restoresPrevious]).toEqual(['A | B*', true]);
  });

  it('forgets to go back once the column to go back to is gone', () => {
    const gone = removeColumnAt(space('A | B | C*', true), 1);
    expect([sketch(gone), gone.restoresPrevious]).toEqual(['A | C*', false]);
  });

  it('leaves an empty workspace with the same id', () => {
    const strip = space('A*', true);
    const empty = removeColumnAt(strip, 0);
    expect(empty).toEqual({
      id: strip.id,
      columns: [],
      activeColumn: 0,
      restoresPrevious: false,
    });
  });
});

describe('removeTile', () => {
  it('removes the whole column of a pane alone in it', () => {
    const wide = { ...space('A | B*'), restoresPrevious: true };
    wide.columns[1] = { ...wide.columns[1], width: 0.7, fullWidth: true };
    const removed = removeTile(wide, { column: 1, tile: 0 });
    expect(removed.paneId).toBe('B');
    expect(removed.size).toEqual({ width: 0.7, fullWidth: true });
    expect(sketch(removed.space)).toBe('A*');
  });

  it('keeps the column of a pane that shares it', () => {
    const removed = removeTile(space('A | B C*'), { column: 1, tile: 1 });
    expect(removed.paneId).toBe('C');
    expect(removed.size).toEqual(HALF);
    expect(sketch(removed.space)).toBe('A | B*');
  });
});

describe('addTileToColumn', () => {
  it('adds at the bottom and focuses the pane and its column', () => {
    const added = addTileToColumn(space('A | B*', true), 'C', {
      column: 0,
      activate: true,
    });
    expect([sketch(added), added.restoresPrevious]).toEqual([
      'A C* | B',
      false,
    ]);
  });

  it('adds at a given place and keeps the focus where it was', () => {
    const added = addTileToColumn(space('A B* | D'), 'C', {
      column: 0,
      tile: 1,
      activate: false,
    });
    expect(sketch(added)).toBe('A C B* | D');
  });

  it('keeps the focused column when focusing a pane in it', () => {
    const strip = space('A* B | D', true);
    const added = addTileToColumn(strip, 'C', {
      column: 0,
      tile: 0,
      activate: true,
    });
    expect([sketch(added), added.restoresPrevious]).toEqual([
      'C* A B | D',
      true,
    ]);
  });
});
