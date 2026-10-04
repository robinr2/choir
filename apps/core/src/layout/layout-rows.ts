import type {
  PaneContent,
  WorkspaceState,
  Column,
  Height,
  Space,
  Tile,
} from './layout.schemas.js';

const STATE_ID = 1;

export type StateRow = {
  id: number;
  activeWorkspace: number;
  nextNumber: number;
};

type WorkspaceRow = {
  id: string;
  position: number;
  activeColumn: number;
  restoresPrevious: boolean;
};

type ColumnRow = {
  id: string;
  workspaceId: string;
  position: number;
  width: number;
  fullWidth: boolean;
  activeTile: number;
};

type PaneRow = {
  id: string;
  columnId: string;
  position: number;
  kind: PaneContent['kind'];
  name: string | null;
  autoHeight: number | null;
  fixedHeight: number | null;
};

export type Rows = {
  state: StateRow;
  workspaces: WorkspaceRow[];
  columns: ColumnRow[];
  panes: PaneRow[];
};

export type SavedWorkspace = WorkspaceRow & {
  columns: (ColumnRow & { panes: PaneRow[] })[];
};

function paneRow(
  { paneId, height }: Tile,
  content: PaneContent,
  place: { columnId: string; position: number },
): PaneRow {
  return {
    id: paneId,
    ...place,
    kind: content.kind,
    name: content.kind === 'agent' ? content.name : null,
    autoHeight: 'auto' in height ? height.auto : null,
    fixedHeight: 'fixed' in height ? height.fixed : null,
  };
}

function columnRow(
  { id, width, fullWidth, activeTile }: Column,
  workspaceId: string,
  position: number,
): ColumnRow {
  return { id, workspaceId, position, width, fullWidth, activeTile };
}

function workspaceRow(
  { id, activeColumn, restoresPrevious }: Space,
  position: number,
): WorkspaceRow {
  return { id, position, activeColumn, restoresPrevious };
}

export function toRows({ layout, panes, nextNumber }: WorkspaceState): Rows {
  const { workspaces, activeWorkspace } = layout;
  const columns = workspaces.flatMap((space) =>
    space.columns.map((column, position) => ({ column, space, position })),
  );
  return {
    state: { id: STATE_ID, activeWorkspace, nextNumber },
    workspaces: workspaces.map(workspaceRow),
    columns: columns.map(({ column, space, position }) =>
      columnRow(column, space.id, position),
    ),
    panes: columns.flatMap(({ column }) =>
      column.tiles.map((tile, position) =>
        paneRow(tile, panes[tile.paneId], { columnId: column.id, position }),
      ),
    ),
  };
}

function heightOf({ autoHeight, fixedHeight }: PaneRow): Height {
  return autoHeight === null
    ? { fixed: Number(fixedHeight) }
    : { auto: autoHeight };
}

function contentOf({ kind, name }: PaneRow): PaneContent {
  return kind === 'agent' ? { kind, name: String(name) } : { kind };
}

function columnOf({
  panes,
  ...row
}: SavedWorkspace['columns'][number]): Column {
  return {
    id: row.id,
    width: row.width,
    fullWidth: row.fullWidth,
    activeTile: row.activeTile,
    tiles: panes.map((pane) => ({ paneId: pane.id, height: heightOf(pane) })),
  };
}

function spaceOf({
  id,
  activeColumn,
  restoresPrevious,
  columns,
}: SavedWorkspace): Space {
  return { id, activeColumn, restoresPrevious, columns: columns.map(columnOf) };
}

export function fromRows(
  state: StateRow,
  workspaces: SavedWorkspace[],
): WorkspaceState {
  const panes = workspaces.flatMap(({ columns }) =>
    columns.flatMap((column) => column.panes),
  );
  return {
    layout: {
      workspaces: workspaces.map(spaceOf),
      activeWorkspace: state.activeWorkspace,
    },
    panes: Object.fromEntries(panes.map((pane) => [pane.id, contentOf(pane)])),
    nextNumber: state.nextNumber,
  };
}
