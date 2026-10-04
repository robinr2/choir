import {
  findPane,
  focusColumn,
  focusPane,
  focusWorkspaceById,
  movePane,
  openPane,
  paneIds,
  removePane,
  resizePane,
} from './monitor-panes.js';
import { layout, sketches } from '../test/sketch.js';

it('lists the panes from the top workspace down, left to right, top to bottom', () => {
  expect(paneIds(layout(['A B | C*', 'D*', '']))).toEqual(['A', 'B', 'C', 'D']);
});

it('finds the workspace, column and place of a pane', () => {
  expect(findPane(layout(['A', 'B | C D*', '']), 'D')).toEqual({
    workspace: 1,
    column: 1,
    tile: 1,
  });
});

describe('openPane', () => {
  it('opens a half-wide column right after the focused one and focuses it', () => {
    const opened = openPane(layout(['A* | B', '']), 'C');
    expect(sketches(opened)).toEqual(['> A | C* | B', '']);
    expect(opened.workspaces[0].columns[1]).toMatchObject({
      width: 0.5,
      fullWidth: false,
    });
    expect(opened.workspaces[0].restoresPrevious).toBe(true);
  });

  it('adds an empty workspace below when opening on the last one', () => {
    expect(sketches(openPane(layout(['A*', ''], 1), 'B'))).toEqual([
      'A*',
      '> B*',
      '',
    ]);
  });
});

describe('removePane', () => {
  it('goes back to the pane it was opened from', () => {
    const opened = openPane(layout(['A* | B', '']), 'C');
    expect(sketches(removePane(opened, 'C'))).toEqual(['> A* | B', '']);
  });

  it('removes a workspace emptied out of view but keeps the focused one', () => {
    expect(sketches(removePane(layout(['A*', 'B*', '']), 'B'))).toEqual([
      '> A*',
      '',
    ]);
    expect(sketches(removePane(layout(['A*', 'B*', ''], 1), 'B'))).toEqual([
      'A*',
      '> ',
      '',
    ]);
  });
});

describe('focusPane', () => {
  it('focuses the pane, its column and its workspace', () => {
    expect(sketches(focusPane(layout(['A* | B C', 'D*', ''], 1), 'C'))).toEqual(
      ['> A | B C*', 'D*', ''],
    );
  });

  it('remembers the way back when focusing inside the focused column', () => {
    const opened = openPane(layout(['A B* | X', '']), 'C');
    const stacked = focusPane(opened, 'C');
    expect(stacked.workspaces[0].restoresPrevious).toBe(true);
    expect(focusPane(opened, 'A').workspaces[0].restoresPrevious).toBe(false);
  });
});

it('focuses a column of the focused workspace and keeps its focused pane', () => {
  const strips = layout(['A* | B C^', '']);
  const column = strips.workspaces[0].columns[1].id;
  expect(sketches(focusColumn(strips, column))).toEqual(['> A | B C*', '']);
});

it('focuses a workspace by its id', () => {
  const strips = layout(['A*', 'B*', '']);
  const { id } = strips.workspaces[1];
  expect(sketches(focusWorkspaceById(strips, id))).toEqual(['A*', '> B*', '']);
});

describe('movePane', () => {
  it('drops a pane as a new column with the width of its old column', () => {
    const strips = layout(['A* B | C', '']);
    strips.workspaces[0].columns[0].width = 0.3;
    const moved = movePane(strips, 'A', { column: 2 });
    expect(sketches(moved ?? strips)).toEqual(['> B | C | A*', '']);
    expect(moved?.workspaces[0].columns[2].width).toBe(0.3);
  });

  it('places the drop among the columns that remain without the pane', () => {
    const moved = movePane(layout(['A* | B | C', '']), 'A', { column: 1 });
    expect(sketches(moved ?? layout([]))).toEqual(['> B | A* | C', '']);
  });

  it('drops a pane into a column at the given place and focuses it', () => {
    const moved = movePane(layout(['A* | B C', '']), 'A', {
      column: 0,
      tile: 1,
    });
    expect(sketches(moved ?? layout([]))).toEqual(['> B A* C', '']);
  });

  it('refuses drop places that do not exist', () => {
    const strips = layout(['A* | B', '']);
    expect(movePane(strips, 'A', { column: 2 })).toBeUndefined();
    expect(movePane(strips, 'A', { column: 1 })).toBeDefined();
    expect(movePane(strips, 'A', { column: 1, tile: 0 })).toBeUndefined();
    expect(movePane(strips, 'A', { column: 0, tile: 2 })).toBeUndefined();
    expect(movePane(strips, 'A', { column: 0, tile: 1 })).toBeDefined();
  });

  it('drops into an emptied focused workspace', () => {
    const moved = movePane(layout(['A*', '']), 'A', { column: 0 });
    expect(sketches(moved ?? layout([]))).toEqual(['> A*', '']);
  });
});

describe('resizePane', () => {
  it('sets the width of the column and the height of the pane', () => {
    const strips = layout(['A | B C', '']);
    strips.workspaces[0].columns[1].fullWidth = true;
    const resized = resizePane(strips, 'C', { width: 0.7, height: 0.25 });
    expect(resized.workspaces[0].columns[1]).toMatchObject({
      width: 0.7,
      fullWidth: false,
      tiles: [
        { paneId: 'B', height: { auto: 1 } },
        { paneId: 'C', height: { fixed: 0.25 } },
      ],
    });
  });

  it('leaves out what it is not given', () => {
    const strips = layout(['A | B C', '']);
    const wider = resizePane(strips, 'B', { width: 0.6 });
    expect(wider.workspaces[0].columns[1].tiles).toEqual(
      strips.workspaces[0].columns[1].tiles,
    );
    const taller = resizePane(strips, 'B', { height: 0.6 });
    expect(taller.workspaces[0].columns[1].width).toBe(0.5);
    expect(taller.workspaces[0].columns[1].tiles[0].height).toEqual({
      fixed: 0.6,
    });
  });
});
