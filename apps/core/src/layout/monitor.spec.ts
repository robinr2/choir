import {
  activateWorkspace,
  emptyLayout,
  focusWindowOrWorkspace,
  focusWorkspace,
  moveColumnToWorkspace,
  moveWindowOrToWorkspace,
  moveWindowToWorkspace,
  moveWorkspace,
  settle,
  updateActiveSpace,
} from './monitor.js';
import { focusColumnRight } from './scrolling-moves.js';
import { layout, sketches } from '../test/sketch.js';
import type { Layout } from './layout.schemas.js';

it('starts with one empty workspace', () => {
  const first = emptyLayout();
  expect(first).toEqual({
    workspaces: [
      {
        id: expect.any(String),
        columns: [],
        activeColumn: 0,
        restoresPrevious: false,
      },
    ],
    activeWorkspace: 0,
  });
});

describe('settle', () => {
  it('keeps exactly one empty workspace at the bottom', () => {
    expect(sketches(settle(layout(['A*'])))).toEqual(['> A*', '']);
    expect(sketches(settle(layout(['A*', '', '', ''])))).toEqual(['> A*', '']);
  });

  it('removes empty workspaces in the middle but keeps the focused one', () => {
    expect(sketches(settle(layout(['A*', '', 'B*', ''], 2)))).toEqual([
      'A*',
      '> B*',
      '',
    ]);
    expect(sketches(settle(layout(['A*', '', 'B*', ''], 1)))).toEqual([
      'A*',
      '> ',
      'B*',
      '',
    ]);
  });
});

it('changes the focused workspace and settles', () => {
  const changed = updateActiveSpace(
    layout(['', ''], 1),
    () => layout(['A*']).workspaces[0],
  );
  expect(sketches(changed)).toEqual(['> A*', '']);
});

describe('focus workspace', () => {
  it('moves focus up and down and stops at the top and the bottom', () => {
    const three = layout(['A*', 'B*', ''], 1);
    expect(sketches(focusWorkspace(three, -1))).toEqual(['> A*', 'B*', '']);
    expect(sketches(focusWorkspace(three, 1))).toEqual(['A*', 'B*', '> ']);
    const top = layout(['A*', ''], 0);
    expect(sketches(focusWorkspace(top, -1))).toEqual(['> A*', '']);
    const bottom = layout(['A*', ''], 1);
    expect(sketches(focusWorkspace(bottom, 1))).toEqual(['A*', '> ']);
  });

  it('removes an empty workspace when focus leaves it', () => {
    expect(
      sketches(focusWorkspace(layout(['A*', '', 'B*', ''], 1), 1)),
    ).toEqual(['A*', '> B*', '']);
  });

  it('activates a workspace by index', () => {
    expect(sketches(activateWorkspace(layout(['A*', 'B*', '']), 1))).toEqual([
      'A*',
      '> B*',
      '',
    ]);
  });
});

describe('move workspace', () => {
  it('swaps the focused workspace with its neighbour and keeps focus on it', () => {
    const three = layout(['A*', 'B*', 'C*', ''], 1);
    expect(sketches(moveWorkspace(three, -1))).toEqual([
      '> B*',
      'A*',
      'C*',
      '',
    ]);
    expect(sketches(moveWorkspace(three, 1))).toEqual(['A*', 'C*', '> B*', '']);
  });

  it('keeps an empty workspace at the bottom when moving down past it', () => {
    expect(sketches(moveWorkspace(layout(['A*', 'B*', ''], 1), 1))).toEqual([
      'A*',
      '> B*',
      '',
    ]);
  });

  it('does nothing at the top', () => {
    expect(sketches(moveWorkspace(layout(['A*', ''], 0), -1))).toEqual([
      '> A*',
      '',
    ]);
  });
});

describe('move column to workspace', () => {
  it('moves the focused column after the focused column there and follows it', () => {
    const moved = moveColumnToWorkspace(layout(['A | B*', 'C*', '']), 1);
    expect(sketches(moved)).toEqual(['A*', '> C | B*', '']);
    expect(moved.workspaces[1].restoresPrevious).toBe(true);
  });

  it('opens a new empty workspace below when moving into the last one', () => {
    expect(sketches(moveColumnToWorkspace(layout(['A | B*', '']), 1))).toEqual([
      'A*',
      '> B*',
      '',
    ]);
  });

  it('removes the workspace it leaves empty', () => {
    expect(
      sketches(moveColumnToWorkspace(layout(['A*', 'B*', ''], 1), -1)),
    ).toEqual(['> A | B*', '']);
  });

  it('does nothing at the top or from an empty workspace', () => {
    const top = layout(['A*', '']);
    expect(moveColumnToWorkspace(top, -1)).toBe(top);
    const empty = layout(['', 'A*'], 0);
    expect(moveColumnToWorkspace(empty, 1)).toBe(empty);
  });
});

describe('move window to workspace', () => {
  it('moves the focused pane as its own column with its width and follows it', () => {
    const source = layout(['A B* | C', 'D*', '']);
    source.workspaces[0].columns[0].width = 0.3;
    const moved: Layout = moveWindowToWorkspace(source, 1);
    expect(sketches(moved)).toEqual(['A* | C', '> D | B*', '']);
    expect(moved.workspaces[1].columns[1].width).toBe(0.3);
  });

  it('moves a pane alone in its column into the last workspace', () => {
    const moved = moveWindowToWorkspace(layout(['A* | C', '']), 1);
    expect(sketches(moved)).toEqual(['C*', '> A*', '']);
  });

  it('does nothing at the bottom or from an empty workspace', () => {
    const bottom = layout(['A*', ''], 1);
    expect(moveWindowToWorkspace(bottom, 1)).toBe(bottom);
    const empty = layout(['', 'A*'], 0);
    expect(moveWindowToWorkspace(empty, 1)).toBe(empty);
  });
});

describe('focus window or workspace', () => {
  it('moves focus inside the column while there is a pane in that direction', () => {
    const stacked = layout(['A* B', 'C*', '']);
    expect(sketches(focusWindowOrWorkspace(stacked, 1))).toEqual([
      '> A B*',
      'C*',
      '',
    ]);
    const lower = layout(['A*', 'B C*', ''], 1);
    expect(sketches(focusWindowOrWorkspace(lower, -1))).toEqual([
      'A*',
      '> B* C',
      '',
    ]);
  });

  it('switches workspace past the bottom or the top pane', () => {
    const bottom = layout(['A B*', 'C*', '']);
    expect(sketches(focusWindowOrWorkspace(bottom, 1))).toEqual([
      'A B*',
      '> C*',
      '',
    ]);
    const top = layout(['A*', 'B* C', ''], 1);
    expect(sketches(focusWindowOrWorkspace(top, -1))).toEqual([
      '> A*',
      'B* C',
      '',
    ]);
  });

  it('switches workspace from an empty workspace', () => {
    expect(sketches(focusWindowOrWorkspace(layout(['A*', ''], 1), -1))).toEqual(
      ['> A*', ''],
    );
  });
});

describe('move window or to workspace', () => {
  it('moves the pane inside the column while there is a pane in that direction', () => {
    expect(sketches(moveWindowOrToWorkspace(layout(['A* B', '']), 1))).toEqual([
      '> B A*',
      '',
    ]);
    expect(sketches(moveWindowOrToWorkspace(layout(['A B*', '']), -1))).toEqual(
      ['> B* A', ''],
    );
  });

  it('moves the pane to the workspace below past the bottom and follows it', () => {
    const moved = moveWindowOrToWorkspace(layout(['A B* | C', 'D*', '']), 1);
    expect(sketches(moved)).toEqual(['A* | C', '> D | B*', '']);
  });

  it('moves the pane to the workspace above past the top and follows it', () => {
    const moved = moveWindowOrToWorkspace(layout(['A*', 'B* C', ''], 1), -1);
    expect(sketches(moved)).toEqual(['> A | B*', 'C*', '']);
  });

  it('does nothing at the top of the first workspace', () => {
    const top = layout(['A* B', '']);
    expect(moveWindowOrToWorkspace(top, -1)).toBe(top);
  });
});

it('changes the focused workspace through a scrolling change', () => {
  const changed = updateActiveSpace(layout(['A* | B', '']), focusColumnRight);
  expect(sketches(changed)).toEqual(['> A | B*', '']);
});
