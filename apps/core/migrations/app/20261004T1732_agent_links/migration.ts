#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/825a10801284527cfba4f5629e05842fbbe00a7817c266b58ae6ff12ae3261cf/contract';
import startContract from '../../snapshots/825a10801284527cfba4f5629e05842fbbe00a7817c266b58ae6ff12ae3261cf/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dba37070cc32be9a890e3d4beb96e86db37a219d6006d9789b57b6c380f8338b/contract';
import endContract from '../../snapshots/dba37070cc32be9a890e3d4beb96e86db37a219d6006d9789b57b6c380f8338b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'AgentSession' }),
      this.createTable({
        schema: 'public',
        table: 'AgentLink',
        columns: [
          col('conversationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('cwd', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('effort', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('mode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('model', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sessionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['conversationId'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
