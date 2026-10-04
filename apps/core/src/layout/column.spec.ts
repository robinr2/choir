import {
  activeTile,
  clampWidth,
  contains,
  focusDown,
  focusUp,
  insertTile,
  moveDown,
  moveUp,
  newColumn,
  removeTileAt,
  resizeColumn,
  setColumnWidth,
  sizeOf,
  toggleFullWidth,
} from './column.js';
import type { Column } from './layout.schemas.js';

function column(names: string[], active = 0): Column {
  return {
    id: 'c',
    width: 0.5,
    fullWidth: false,
    activeTile: active,
    tiles: names.map((paneId) => ({ paneId, height: { auto: 1 } })),
  };
}

function paneNames({ tiles }: Column): string[] {
  return tiles.map(({ paneId }) => paneId);
}

describe('newColumn', () => {
  it('holds one auto-height pane at the given size with its own id', () => {
    const first = newColumn('A', { width: 0.3, fullWidth: true });
    expect(first).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      width: 0.3,
      fullWidth: true,
      activeTile: 0,
      tiles: [{ paneId: 'A', height: { auto: 1 } }],
    });
    expect(newColumn('A', sizeOf(first)).id).not.toBe(first.id);
  });
});

it('knows its panes, its active pane and its size', () => {
  const stack = { ...column(['A', 'B'], 1), width: 0.7 };
  expect(contains(stack, 'B')).toBe(true);
  expect(contains(stack, 'C')).toBe(false);
  expect(activeTile(stack).paneId).toBe('B');
  expect(sizeOf(stack)).toEqual({ width: 0.7, fullWidth: false });
});

describe('focus up and down', () => {
  it('moves focus one pane and stops at the top and the bottom', () => {
    expect(focusDown(column(['A', 'B', 'C'], 1)).activeTile).toBe(2);
    expect(focusDown(column(['A', 'B', 'C'], 2)).activeTile).toBe(2);
    expect(focusUp(column(['A', 'B', 'C'], 1)).activeTile).toBe(0);
    expect(focusUp(column(['A', 'B', 'C'], 0)).activeTile).toBe(0);
  });
});

describe('move up and down', () => {
  it('swaps the active pane with its neighbour and keeps it active', () => {
    const down = moveDown(column(['A', 'B', 'C'], 1));
    expect([paneNames(down), down.activeTile]).toEqual([['A', 'C', 'B'], 2]);
    const up = moveUp(column(['A', 'B', 'C'], 1));
    expect([paneNames(up), up.activeTile]).toEqual([['B', 'A', 'C'], 0]);
  });

  it('does nothing at the top or the bottom', () => {
    const top = column(['A', 'B'], 0);
    const bottom = column(['A', 'B'], 1);
    expect(moveUp(top)).toBe(top);
    expect(moveDown(bottom)).toBe(bottom);
  });
});

describe('insertTile', () => {
  it('adds an auto-height pane and keeps the active pane active', () => {
    const above = insertTile(column(['A', 'B'], 1), 1, 'C');
    expect([paneNames(above), above.activeTile]).toEqual([['A', 'C', 'B'], 2]);
    expect(above.tiles[1].height).toEqual({ auto: 1 });
    const below = insertTile(column(['A', 'B'], 0), 1, 'C');
    expect([paneNames(below), below.activeTile]).toEqual([['A', 'C', 'B'], 0]);
  });
});

describe('removeTileAt', () => {
  it('keeps the active pane when a pane above or below goes', () => {
    expect(removeTileAt(column(['A', 'B', 'C'], 1), 0).activeTile).toBe(0);
    expect(removeTileAt(column(['A', 'B', 'C'], 1), 2).activeTile).toBe(1);
  });

  it('focuses the pane below the closed active one, or above at the bottom', () => {
    const middle = removeTileAt(column(['A', 'B', 'C'], 1), 1);
    expect([paneNames(middle), middle.activeTile]).toEqual([['A', 'C'], 1]);
    const bottom = removeTileAt(column(['A', 'B', 'C'], 2), 2);
    expect([paneNames(bottom), bottom.activeTile]).toEqual([['A', 'B'], 1]);
  });

  it('resets the weight of the last auto pane to 1 but keeps a fixed height', () => {
    const weighted = {
      ...column(['A', 'B']),
      tiles: [
        { paneId: 'A', height: { auto: 2.5 } },
        { paneId: 'B', height: { auto: 0.5 } },
      ],
    };
    expect(removeTileAt(weighted, 1).tiles).toEqual([
      { paneId: 'A', height: { auto: 1 } },
    ]);
    const fixed = {
      ...weighted,
      tiles: [weighted.tiles[0], { paneId: 'B', height: { fixed: 0.3 } }],
    };
    expect(removeTileAt(fixed, 0).tiles).toEqual([
      { paneId: 'B', height: { fixed: 0.3 } },
    ]);
    const three = {
      ...weighted,
      tiles: [...weighted.tiles, weighted.tiles[1]],
    };
    expect(removeTileAt(three, 2).tiles).toEqual(weighted.tiles);
  });
});

describe('widths', () => {
  it('adjusts the width by percent points from the shown width', () => {
    expect(setColumnWidth(column(['A']), 10).width).toBeCloseTo(0.6);
    expect(setColumnWidth(column(['A']), -10).width).toBeCloseTo(0.4);
    const full = setColumnWidth(toggleFullWidth(column(['A'])), -10);
    expect(full).toMatchObject({ fullWidth: false });
    expect(full.width).toBeCloseTo(0.9);
  });

  it('keeps proportions between 0 and 10000', () => {
    expect(clampWidth(-1)).toBe(0);
    expect(clampWidth(0.25)).toBe(0.25);
    expect(clampWidth(20_000)).toBe(10_000);
    expect(setColumnWidth(column(['A']), -60).width).toBe(0);
  });

  it('sets a resized width and leaves full width', () => {
    const resized = resizeColumn(toggleFullWidth(column(['A'])), 0.75);
    expect(resized).toMatchObject({ width: 0.75, fullWidth: false });
    expect(resizeColumn(column(['A']), -2).width).toBe(0);
  });

  it('toggles full width and back to the kept width', () => {
    const full = toggleFullWidth(column(['A']));
    expect(full).toMatchObject({ width: 0.5, fullWidth: true });
    expect(toggleFullWidth(full)).toMatchObject({
      width: 0.5,
      fullWidth: false,
    });
  });
});
