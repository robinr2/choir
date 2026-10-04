#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/18a19b223620a30c64bea0cff90529bfa1e50363a9ed2f99afdd9588cbb43bdb/contract';
import startContract from '../../snapshots/18a19b223620a30c64bea0cff90529bfa1e50363a9ed2f99afdd9588cbb43bdb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/4761329d57fc1d1743f690d6dd94919d7666f59c315fa4571b498afa7fbfb05b/contract';
import endContract from '../../snapshots/4761329d57fc1d1743f690d6dd94919d7666f59c315fa4571b498afa7fbfb05b/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'LayoutColumn',
        columns: [
          col('activeTile', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('fullWidth', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('width', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('workspaceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'LayoutState',
        columns: [
          col('activeWorkspace', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nextNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Pane',
        columns: [
          col('autoHeight', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('columnId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('fixedHeight', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Pane_kind_check_36d7f133',
            "\"kind\" IN ('empty', 'agent', 'excalidraw')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Workspace',
        columns: [
          col('activeColumn', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('restoresPrevious', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LayoutColumn',
        index: 'LayoutColumn_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Pane',
        index: 'Pane_columnId_idx_728f084b',
        columns: ['columnId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LayoutColumn',
        foreignKey: {
          name: 'LayoutColumn_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Pane',
        foreignKey: {
          name: 'Pane_columnId_fkey',
          columns: ['columnId'],
          references: { schema: 'public', table: 'LayoutColumn', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
