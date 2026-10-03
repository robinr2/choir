#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/18a19b223620a30c64bea0cff90529bfa1e50363a9ed2f99afdd9588cbb43bdb/contract';
import endContract from '../../snapshots/18a19b223620a30c64bea0cff90529bfa1e50363a9ed2f99afdd9588cbb43bdb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Attachment',
        columns: [
          col('content', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('filename', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('index', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mediaType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notificationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Notification',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('eventId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('link', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('receivedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('sentAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'QueueItem',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('doneAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('dueAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notificationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['notificationId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Todo',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('dueAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('position', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'TodoNotification',
        columns: [
          col('linkedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('notificationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('todoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['todoId', 'notificationId'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Attachment',
        constraint: 'Attachment_notificationId_index_key',
        columns: ['notificationId', 'index'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Notification',
        constraint: 'Notification_source_eventId_key',
        columns: ['source', 'eventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_notificationId_idx_adfe2654',
        columns: ['notificationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'QueueItem',
        index: 'QueueItem_dueAt_idx_08d8815e',
        columns: ['dueAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TodoNotification',
        index: 'TodoNotification_notificationId_idx_adfe2654',
        columns: ['notificationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TodoNotification',
        index: 'TodoNotification_todoId_idx_6e8c4480',
        columns: ['todoId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_notificationId_fkey',
          columns: ['notificationId'],
          references: { schema: 'public', table: 'Notification', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'QueueItem',
        foreignKey: {
          name: 'QueueItem_notificationId_fkey',
          columns: ['notificationId'],
          references: { schema: 'public', table: 'Notification', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TodoNotification',
        foreignKey: {
          name: 'TodoNotification_todoId_fkey',
          columns: ['todoId'],
          references: { schema: 'public', table: 'Todo', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TodoNotification',
        foreignKey: {
          name: 'TodoNotification_notificationId_fkey',
          columns: ['notificationId'],
          references: { schema: 'public', table: 'Notification', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
