import { preview } from './listing.js';

type Instant = Temporal.Instant;

export const NOTIFICATION_SUMMARY = [
  'id',
  'source',
  'title',
  'text',
  'sentAt',
  'archivedAt',
] as const;

type NotificationRow = {
  id: string;
  source: string;
  title: string;
  text: string;
  sentAt: Instant;
  archivedAt: Instant | null;
};

export type NotificationSummary = Omit<NotificationRow, 'text'> & {
  preview: string;
};

export type AttachmentInfo = {
  index: number;
  filename: string;
  mediaType: string;
};

export type AttachmentFile = AttachmentInfo & { content: Uint8Array };

export type LinkedFile = AttachmentFile & { notificationId: string };

export type NotificationDetail = NotificationSummary & {
  text: string;
  link: string | null;
  attachments: AttachmentInfo[];
};

export function notificationSummary({
  text,
  ...row
}: NotificationRow): NotificationSummary {
  return { ...row, preview: preview(text) };
}

export function notificationDetail(
  row: NotificationRow & { link: string | null; attachments: AttachmentInfo[] },
): NotificationDetail {
  return {
    ...notificationSummary(row),
    text: row.text,
    link: row.link,
    attachments: row.attachments,
  };
}
