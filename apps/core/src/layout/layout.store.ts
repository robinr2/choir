import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService, type Orm } from '../database/database.service.js';
import type { WorkspaceState } from './layout.schemas.js';
import { fromRows, type Rows, STATE_ID, toRows } from './layout-rows.js';

function savedWorkspaces(orm: Orm) {
  return orm.Workspace.orderBy((workspace) => workspace.position.asc())
    .include('columns', (columns) =>
      columns
        .orderBy((column) => column.position.asc())
        .include('panes', (panes) =>
          panes.orderBy((pane) => pane.position.asc()),
        ),
    )
    .all();
}

async function replaceRows(orm: Orm, rows: Rows): Promise<void> {
  await orm.LayoutState.where((state) => state.id.gte(0)).deleteAndCount();
  await orm.Workspace.where((space) => space.position.gte(0)).deleteAndCount();
  await orm.LayoutState.create(rows.state);
  await orm.Workspace.createAndCount(rows.workspaces);
  if (rows.columns.length === 0) return;
  await orm.LayoutColumn.createAndCount(rows.columns);
  await orm.Pane.createAndCount(rows.panes);
}

@Injectable()
export class LayoutStore {
  private saving = Promise.resolve();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async load(): Promise<WorkspaceState | undefined> {
    const { orm } = this.database;
    const state = await orm.LayoutState.where({ id: STATE_ID }).first();
    if (!state) return undefined;
    return fromRows(state, await savedWorkspaces(orm));
  }

  save(state: WorkspaceState): Promise<void> {
    const rows = toRows(state);
    const write = () =>
      this.database.client.transaction((tx) =>
        replaceRows(tx.orm.public, rows),
      );
    this.saving = this.saving.then(write, write);
    return this.saving;
  }
}
