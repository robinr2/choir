import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export type QueuedNotification = { notificationId: string; attempts: number };

@Injectable()
export class JudgeQueueStore {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  next(now: Temporal.Instant): Promise<QueuedNotification | null> {
    return this.database.orm.QueueItem.where((item) => item.doneAt.isNull())
      .where((item) => item.dueAt.lte(now))
      .orderBy((item) => item.dueAt.asc())
      .select('notificationId', 'attempts')
      .first();
  }

  async done(notificationId: string, now: Temporal.Instant): Promise<void> {
    await this.database.orm.QueueItem.where({ notificationId }).update({
      doneAt: now,
    });
  }

  async retry(
    notificationId: string,
    {
      attempts,
      dueAt,
      error,
    }: { attempts: number; dueAt: Temporal.Instant; error: string },
  ): Promise<void> {
    await this.database.orm.QueueItem.where({ notificationId }).update({
      attempts,
      dueAt,
      lastError: error,
    });
  }
}
