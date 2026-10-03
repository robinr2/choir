import { LiveStore, send } from '@/lib/live-store';

export type ListKind = 'notifications' | 'todos';

export type NotificationSummary = {
  id: string;
  source: string;
  title: string;
  preview: string;
  sentAt: string;
  archivedAt: string | null;
};

type AttachmentInfo = {
  index: number;
  filename: string;
  mediaType: string;
};

export type NotificationDetail = NotificationSummary & {
  text: string;
  link: string | null;
  attachments: AttachmentInfo[];
};

export type TodoSummary = {
  id: string;
  title: string;
  description: string;
  preview: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type LinkedNotification = Pick<
  NotificationSummary,
  'id' | 'source' | 'title' | 'sentAt'
>;

export type LinkedAttachment = AttachmentInfo & { notificationId: string };

export type TodoDetail = TodoSummary & {
  notifications: LinkedNotification[];
  attachments: LinkedAttachment[];
};

export type TodoDraft = {
  title: string;
  description: string;
  dueAt: string | null;
};

export type Placement = { before: string } | { after: string };

export type ListQuery = { archived: boolean; search: string };

export type InboxSnapshot = {
  notifications: number;
  todos: number;
  revision: number;
};

type Counts = Omit<InboxSnapshot, 'revision'>;

type Read = { revision: number; data: Promise<any> };

export function listPath(
  kind: ListKind,
  { archived, search }: ListQuery,
): string {
  const query = new URLSearchParams({ archived: String(archived), search });
  return `/${kind}?${query}`;
}

export function attachmentUrl(notificationId: string, index: number): string {
  return `/notifications/${notificationId}/attachments/${index}`;
}

async function json<T>(response: Promise<Response>): Promise<T> {
  return (await response).json();
}

export class CoreInbox extends LiveStore<InboxSnapshot> {
  readonly #reads = new Map<string, Read>();

  constructor() {
    super('/inbox/events', { notifications: 0, todos: 0, revision: 0 });
  }

  read<T>(path: string, revision: number): Promise<T> {
    const cached = this.#reads.get(path);
    if (cached?.revision === revision) return cached.data;
    const data = json<T>(send('GET', path));
    this.#reads.set(path, { revision, data });
    return data;
  }

  async archive(kind: ListKind, id: string, archived: boolean): Promise<void> {
    await send('PATCH', `/${kind}/${id}`, { archived });
  }

  async move(kind: ListKind, id: string, placement: Placement): Promise<void> {
    await send('PUT', `/${kind}/${id}/position`, placement);
  }

  createTodo(
    draft: TodoDraft & { notificationIds: string[] },
  ): Promise<TodoDetail> {
    return json(send('POST', '/todos', draft));
  }

  updateTodo(id: string, draft: TodoDraft): Promise<TodoDetail> {
    return json(send('PATCH', `/todos/${id}`, draft));
  }

  link(todoId: string, notificationId: string): Promise<TodoDetail> {
    return json(
      send('POST', `/todos/${todoId}/notifications`, { notificationId }),
    );
  }

  protected receive(counts: Counts): void {
    this.update({ ...counts, revision: this.getSnapshot().revision + 1 });
  }
}
