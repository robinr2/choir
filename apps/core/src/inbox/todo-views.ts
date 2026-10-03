import { preview } from './listing.js';
import type { AttachmentInfo, LinkedFile } from './notification-views.js';

type Instant = Temporal.Instant;

export const TODO_FIELDS = [
  'id',
  'title',
  'description',
  'dueAt',
  'createdAt',
  'updatedAt',
  'archivedAt',
] as const;

type TodoRow = {
  id: string;
  title: string;
  description: string;
  dueAt: Instant | null;
  createdAt: Instant;
  updatedAt: Instant;
  archivedAt: Instant | null;
};

export type TodoSummary = TodoRow & { preview: string };

type LinkedNotification = {
  id: string;
  source: string;
  title: string;
  sentAt: Instant;
};

type LinkedAttachment = AttachmentInfo & { notificationId: string };

export type TodoDetail = TodoSummary & {
  notifications: LinkedNotification[];
  attachments: LinkedAttachment[];
};

export type GrabbedTodo = TodoDetail & { files: LinkedFile[] };

type LinkRow = {
  notification: (LinkedNotification & { attachments: AttachmentInfo[] }) | null;
};

export function todoSummary(row: TodoRow): TodoSummary {
  return { ...row, preview: preview(row.description) };
}

export function todoDetail(
  row: TodoRow & { notifications: LinkRow[] },
): TodoDetail {
  const linked = row.notifications.flatMap(({ notification }) =>
    notification ? [notification] : [],
  );
  return {
    ...todoSummary(row),
    notifications: linked.map(({ id, source, title, sentAt }) => ({
      id,
      source,
      title,
      sentAt,
    })),
    attachments: linked.flatMap(({ id, attachments }) =>
      attachments.map((file) => ({ notificationId: id, ...file })),
    ),
  };
}
