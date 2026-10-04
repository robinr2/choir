import type { WorkspaceState } from './layout.schemas.js';
import { fromRows, type SavedWorkspace, toRows } from './layout-rows.js';
import { layout } from '../test/sketch.js';

function saved(): WorkspaceState {
  const strips = layout(['A | B C*', 'D*', ''], 1);
  const [first] = strips.workspaces;
  first.restoresPrevious = true;
  first.columns[0] = { ...first.columns[0], width: 0.3, fullWidth: true };
  first.columns[1].tiles[1].height = { fixed: 0.4 };
  return {
    layout: strips,
    panes: {
      A: { kind: 'agent', name: 'writer' },
      B: { kind: 'excalidraw' },
      C: { kind: 'empty' },
      D: { kind: 'agent', name: 'agent 4' },
    },
    nextNumber: 5,
  };
}

function nested({ workspaces, columns, panes }: ReturnType<typeof toRows>) {
  return workspaces.map((workspace): SavedWorkspace =>
    Object.assign(
      {
        columns: columns
          .filter((column) => column.workspaceId === workspace.id)
          .map((column) =>
            Object.assign(
              { panes: panes.filter((pane) => pane.columnId === column.id) },
              column,
            ),
          ),
      },
      workspace,
    ),
  );
}

it('turns the state into rows in order', () => {
  const state = saved();
  const rows = toRows(state);
  const [first, second, last] = state.layout.workspaces;
  expect(rows.state).toEqual({ id: 1, activeWorkspace: 1, nextNumber: 5 });
  expect(rows.workspaces).toEqual([
    { id: first.id, position: 0, activeColumn: 1, restoresPrevious: true },
    { id: second.id, position: 1, activeColumn: 0, restoresPrevious: false },
    { id: last.id, position: 2, activeColumn: 0, restoresPrevious: false },
  ]);
  expect(rows.columns[0]).toEqual({
    id: first.columns[0].id,
    workspaceId: first.id,
    position: 0,
    width: 0.3,
    fullWidth: true,
    activeTile: 0,
  });
  expect(rows.columns.map(({ position }) => position)).toEqual([0, 1, 0]);
  expect(rows.panes).toEqual([
    {
      id: 'A',
      columnId: first.columns[0].id,
      position: 0,
      kind: 'agent',
      name: 'writer',
      autoHeight: 1,
      fixedHeight: null,
    },
    {
      id: 'B',
      columnId: first.columns[1].id,
      position: 0,
      kind: 'excalidraw',
      name: null,
      autoHeight: 1,
      fixedHeight: null,
    },
    {
      id: 'C',
      columnId: first.columns[1].id,
      position: 1,
      kind: 'empty',
      name: null,
      autoHeight: null,
      fixedHeight: 0.4,
    },
    {
      id: 'D',
      columnId: second.columns[0].id,
      position: 0,
      kind: 'agent',
      name: 'agent 4',
      autoHeight: 1,
      fixedHeight: null,
    },
  ]);
});

it('reads back the state it saved', () => {
  const state = saved();
  const rows = toRows(state);
  expect(fromRows(rows.state, nested(rows))).toEqual(state);
});
