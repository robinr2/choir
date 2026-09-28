import { Inject, Injectable } from '@nestjs/common';
import { type Observable, startWith, switchMap } from 'rxjs';
import { DatabaseService } from '../database/database.service.js';
import { InboxEvents } from './inbox-events.js';

export type InboxCounts = { notifications: number; todos: number };

@Injectable()
export class InboxCountsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(InboxEvents) private readonly events: InboxEvents,
  ) {}

  get changes(): Observable<InboxCounts> {
    return this.events.changed.pipe(
      startWith(undefined),
      switchMap(() => this.counts()),
    );
  }

  async counts(): Promise<InboxCounts> {
    const { orm } = this.database;
    const [notifications, todos] = await Promise.all([
      orm.Notification.where((entry) => entry.archivedAt.isNull()).aggregate(
        (all) => ({
          active: all.count(),
        }),
      ),
      orm.Todo.where((entry) => entry.archivedAt.isNull()).aggregate((all) => ({
        active: all.count(),
      })),
    ]);
    return { notifications: notifications.active, todos: todos.active };
  }
}
