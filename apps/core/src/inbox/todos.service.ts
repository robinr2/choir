import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { or } from '@prisma/orm-postgres/orm-client';
import { DatabaseService, type Orm } from '../database/database.service.js';
import { InboxEvents } from './inbox-events.js';
import { containing, type ListQuery, type Placement } from './listing.js';
import { NotificationsService } from './notifications.service.js';
import { move, type RankedTable, rankedTable } from './positions.js';
import { instant, type NewTodo, type TodoChange } from './todo-input.js';
import {
  type GrabbedTodo,
  TODO_FIELDS,
  type TodoDetail,
  todoDetail,
  type TodoSummary,
  todoSummary,
} from './todo-views.js';

const LINKED_NOTIFICATION = ['id', 'source', 'title', 'sentAt'] as const;

const ATTACHMENT_INFO = ['index', 'filename', 'mediaType'] as const;

function changed({ archived, dueAt, ...rest }: TodoChange) {
  const now = Temporal.Now.instant();
  return {
    ...rest,
    ...(dueAt !== undefined && { dueAt: instant(dueAt) }),
    ...(archived !== undefined && { archivedAt: archived ? now : null }),
    updatedAt: now,
  };
}

async function nextPosition(orm: Orm): Promise<number> {
  const { last } = await orm.Todo.aggregate((all) => ({
    last: all.max('position'),
  }));
  return (last ?? 0) + 1;
}

async function requireNotifications(
  orm: Orm,
  ids: readonly string[],
): Promise<void> {
  const found = await orm.Notification.where((entry) => entry.id.in([...ids]))
    .select('id')
    .all();
  const missing = ids.find((id) => !found.some((entry) => entry.id === id));
  if (missing)
    throw new NotFoundException(`There is no notification ${missing}`);
}

async function linkNotifications(
  orm: Orm,
  todoId: string,
  notificationIds: readonly string[],
): Promise<void> {
  const linked = await orm.TodoNotification.where({ todoId })
    .select('notificationId')
    .all();
  const known = new Set(linked.map(({ notificationId }) => notificationId));
  const fresh = [...new Set(notificationIds)].filter((id) => !known.has(id));
  await requireNotifications(orm, fresh);
  await Promise.all(
    fresh.map((notificationId) =>
      orm.TodoNotification.create({ todoId, notificationId }),
    ),
  );
}

async function storeTodo(orm: Orm, todo: NewTodo): Promise<string> {
  const { id } = await orm.Todo.create({
    title: todo.title,
    description: todo.description,
    dueAt: instant(todo.dueAt),
    position: await nextPosition(orm),
  });
  await linkNotifications(orm, id, todo.notificationIds);
  return id;
}

function todoRanks(orm: Orm): RankedTable {
  const table = orm.Todo;
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
    'to-do',
  );
}

@Injectable()
export class TodosService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(InboxEvents) private readonly events: InboxEvents,
    @Inject(NotificationsService)
    private readonly notifications: Pick<NotificationsService, 'attachments'>,
  ) {}

  async list({ archived, search }: ListQuery): Promise<TodoSummary[]> {
    let entries = this.database.orm.Todo.select(...TODO_FIELDS);
    if (!archived)
      entries = entries.where((entry) => entry.archivedAt.isNull());
    const pattern = containing(search);
    entries = entries.where((entry) =>
      or(entry.title.ilike(pattern), entry.description.ilike(pattern)),
    );
    const rows = await entries.orderBy((entry) => entry.position.asc()).all();
    return rows.map(todoSummary);
  }

  async detail(id: string): Promise<TodoDetail> {
    const row = await this.database.orm.Todo.where({ id })
      .select(...TODO_FIELDS)
      .include('notifications', (links) =>
        links
          .orderBy((link) => link.linkedAt.asc())
          .include('notification', (notification) =>
            notification
              .select(...LINKED_NOTIFICATION)
              .include('attachments', (files) =>
                files
                  .select(...ATTACHMENT_INFO)
                  .orderBy((file) => file.index.asc()),
              ),
          ),
      )
      .first();
    if (!row) throw new NotFoundException(`There is no to-do ${id}`);
    return todoDetail(row);
  }

  async create(todo: NewTodo): Promise<TodoDetail> {
    const id = await this.database.client.transaction((tx) =>
      storeTodo(tx.orm.public, todo),
    );
    this.events.change();
    return this.detail(id);
  }

  async update(id: string, change: TodoChange): Promise<TodoDetail> {
    await this.database.orm.Todo.where({ id }).update(changed(change));
    this.events.change();
    return this.detail(id);
  }

  async link(id: string, notificationId: string): Promise<TodoDetail> {
    await this.database.client.transaction(async (tx) => {
      const todos = tx.orm.public.Todo;
      const updated = await todos
        .where({ id })
        .select('id')
        .update(changed({}));
      if (!updated) throw new NotFoundException(`There is no to-do ${id}`);
      await linkNotifications(tx.orm.public, id, [notificationId]);
    });
    this.events.change();
    return this.detail(id);
  }

  async grab(id: string): Promise<GrabbedTodo> {
    const todo = await this.update(id, { archived: true });
    const ids = todo.notifications.map((notification) => notification.id);
    return { ...todo, files: await this.notifications.attachments(ids) };
  }

  async move(id: string, placement: Placement): Promise<void> {
    await move(todoRanks(this.database.orm), id, placement);
    this.events.change();
  }
}
