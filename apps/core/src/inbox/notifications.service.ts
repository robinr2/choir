import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { or } from '@prisma/orm-postgres/orm-client';
import { DatabaseService, type Orm } from '../database/database.service.js';
import { InboxEvents } from './inbox-events.js';
import { containing, type ListQuery, type Placement } from './listing.js';
import type { NotificationEvent } from './notification-event.js';
import {
  type AttachmentFile,
  type LinkedFile,
  NOTIFICATION_SUMMARY,
  type NotificationDetail,
  notificationDetail,
  type NotificationSummary,
  notificationSummary,
} from './notification-views.js';
import { move, type RankedTable, rankedTable } from './positions.js';

export type Received = { id: string; created: boolean };

const ATTACHMENT_INFO = ['index', 'filename', 'mediaType'] as const;

async function nextPosition(orm: Orm): Promise<number> {
  const { last } = await orm.Notification.aggregate((all) => ({
    last: all.max('position'),
  }));
  return (last ?? 0) + 1;
}

async function storeNotification(
  orm: Orm,
  { id: eventId, source, time, data }: NotificationEvent,
): Promise<string> {
  const { id } = await orm.Notification.create({
    source,
    eventId,
    title: data.title,
    text: data.text,
    link: data.link ?? null,
    sentAt: Temporal.Instant.from(time),
    position: await nextPosition(orm),
  });
  await Promise.all(
    data.attachments.map((file, index) =>
      orm.Attachment.create({
        notificationId: id,
        index,
        filename: file.filename,
        mediaType: file.mediaType,
        content: Buffer.from(file.contentBase64, 'base64'),
      }),
    ),
  );
  await orm.QueueItem.create({ notificationId: id });
  return id;
}

function notificationRanks(orm: Orm): RankedTable {
  const table = orm.Notification;
  return rankedTable(
    {
      find: (id) => table.where({ id }).select('position').first(),
      neighbour: (position, side) =>
        table
          .where((entry) =>
            side === 'after'
              ? entry.position.gt(position)
              : entry.position.lt(position),
          )
          .orderBy((entry) =>
            side === 'after' ? entry.position.asc() : entry.position.desc(),
          )
          .select('position')
          .first(),
      place: (id, position) => table.where({ id }).update({ position }),
      ordered: () =>
        table
          .select('id')
          .orderBy((entry) => entry.position.asc())
          .all(),
    },
    'notification',
  );
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(InboxEvents) private readonly events: InboxEvents,
  ) {}

  async receive(event: NotificationEvent): Promise<Received> {
    const existing = await this.database.orm.Notification.where({
      source: event.source,
      eventId: event.id,
    })
      .select('id')
      .first();
    if (existing) return { id: existing.id, created: false };
    const id = await this.database.client.transaction((tx) =>
      storeNotification(tx.orm.public, event),
    );
    this.events.receive(id);
    return { id, created: true };
  }

  async list({ archived, search }: ListQuery): Promise<NotificationSummary[]> {
    let entries = this.database.orm.Notification.select(
      ...NOTIFICATION_SUMMARY,
    );
    if (!archived)
      entries = entries.where((entry) => entry.archivedAt.isNull());
    const pattern = containing(search);
    entries = entries.where((entry) =>
      or(entry.title.ilike(pattern), entry.text.ilike(pattern)),
    );
    const rows = await entries.orderBy((entry) => entry.position.asc()).all();
    return rows.map(notificationSummary);
  }

  async detail(id: string): Promise<NotificationDetail> {
    const row = await this.database.orm.Notification.where({ id })
      .select(...NOTIFICATION_SUMMARY, 'link')
      .include('attachments', (files) =>
        files.select(...ATTACHMENT_INFO).orderBy((file) => file.index.asc()),
      )
      .first();
    if (!row) throw new NotFoundException(`There is no notification ${id}`);
    return notificationDetail(row);
  }

  async attachment(id: string, index: number): Promise<AttachmentFile> {
    const file = await this.database.orm.Attachment.where({
      notificationId: id,
      index,
    })
      .select(...ATTACHMENT_INFO, 'content')
      .first();
    if (!file)
      throw new NotFoundException(
        `Notification ${id} has no attachment ${index}`,
      );
    return file;
  }

  async attachments(ids: readonly string[]): Promise<LinkedFile[]> {
    return this.database.orm.Attachment.where((file) =>
      file.notificationId.in([...ids]),
    )
      .select('notificationId', ...ATTACHMENT_INFO, 'content')
      .all();
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    const updated = await this.database.orm.Notification.where({ id })
      .select('id')
      .update({ archivedAt: archived ? Temporal.Now.instant() : null });
    if (!updated) throw new NotFoundException(`There is no notification ${id}`);
    this.events.change();
  }

  async move(id: string, placement: Placement): Promise<void> {
    await move(notificationRanks(this.database.orm), id, placement);
    this.events.change();
  }
}
