import type {
  NotificationDetail,
  NotificationSummary,
  TodoDetail,
  TodoSummary,
} from '@/inbox/core-inbox';
import { streamOf } from './fake-event-source';

export const N1 = '1d2c3b4a-5f6e-4d7c-8b9a-0f1e2d3c4b5a';
export const N2 = '2e3d4c5b-6a7f-4e8d-9c0b-1a2f3e4d5c6b';
export const T1 = '3f4e5d6c-7b8a-4f9e-8d1c-2b3a4f5e6d7c';
export const T2 = '4a5f6e7d-8c9b-4a0f-9e2d-3c4b5a6f7e8d';

export function notification(
  overrides: Partial<NotificationDetail> = {},
): NotificationDetail {
  return {
    id: N1,
    source: 'outlook',
    title: 'Production is down',
    preview: 'Hi Sam, production is down since eight …',
    text: 'Hi Sam, production is down since eight in the morning.',
    link: null,
    sentAt: '2026-09-28T06:14:00Z',
    archivedAt: null,
    attachments: [],
    ...overrides,
  };
}

export function todo(overrides: Partial<TodoDetail> = {}): TodoDetail {
  return {
    id: T1,
    title: 'Check the logs',
    description: 'Look at the login service first.',
    preview: 'Look at the login service first.',
    dueAt: null,
    createdAt: '2026-09-28T07:00:00Z',
    updatedAt: '2026-09-28T07:30:00Z',
    archivedAt: null,
    notifications: [],
    attachments: [],
    ...overrides,
  };
}

type Inbox = { notifications: NotificationDetail[]; todos: TodoDetail[] };

const inbox: Inbox = { notifications: [], todos: [] };

export function coreHasInbox(data: Partial<Inbox>): void {
  inbox.notifications = data.notifications ?? [];
  inbox.todos = data.todos ?? [];
}

function listed<T extends NotificationSummary | TodoSummary>(
  entries: T[],
  query: URLSearchParams,
): T[] {
  const search = query.get('search')?.toLowerCase() ?? '';
  return entries
    .filter(
      (entry) => query.get('archived') === 'true' || entry.archivedAt === null,
    )
    .filter((entry) => entry.title.toLowerCase().includes(search));
}

function found(entries: { id: string }[], id: string): Response {
  const entry = entries.find((candidate) => candidate.id === id);
  return entry ? Response.json(entry) : new Response(null, { status: 404 });
}

function kindOf(url: URL): keyof Inbox | undefined {
  const [, kind] = url.pathname.split('/');
  return kind === 'notifications' || kind === 'todos' ? kind : undefined;
}

function read(kind: keyof Inbox, url: URL): Response {
  const entries: (NotificationDetail | TodoDetail)[] = inbox[kind];
  const [, , id] = url.pathname.split('/');
  if (id) return found(entries, id);
  return Response.json(listed(entries, url.searchParams));
}

export function inboxResponse(
  path: string,
  method = 'GET',
): Response | undefined {
  const url = new URL(path, 'http://choir.test');
  const kind = kindOf(url);
  if (!kind) return undefined;
  if (method === 'GET') return read(kind, url);
  return kind === 'todos' ? Response.json(todo()) : undefined;
}

export function coreCounts(notifications: number, todos: number): void {
  streamOf('/inbox/events')?.receive({ notifications, todos });
}
