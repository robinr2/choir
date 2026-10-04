#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4761329d57fc1d1743f690d6dd94919d7666f59c315fa4571b498afa7fbfb05b/contract';
import startContract from '../../snapshots/4761329d57fc1d1743f690d6dd94919d7666f59c315fa4571b498afa7fbfb05b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/825a10801284527cfba4f5629e05842fbbe00a7817c266b58ae6ff12ae3261cf/contract';
import endContract from '../../snapshots/825a10801284527cfba4f5629e05842fbbe00a7817c266b58ae6ff12ae3261cf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'AgentSession',
        columns: [
          col('conversationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('sessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['conversationId'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
