import { z } from 'zod';

export const CLOUDEVENTS_JSON = 'application/cloudevents+json';

const attachmentSchema = z.object({
  filename: z.string().trim().min(1),
  mediaType: z.string().trim().min(1),
  contentBase64: z.base64(),
});

export const notificationEventSchema = z.object({
  specversion: z.literal('1.0'),
  id: z.string().min(1),
  source: z.string().trim().min(1),
  type: z.literal('choir.notification.v1'),
  time: z.iso.datetime({ offset: true }),
  datacontenttype: z.literal('application/json').optional(),
  subject: z.string().optional(),
  data: z.object({
    title: z.string().trim().min(1),
    text: z.string(),
    link: z.url().optional(),
    attachments: z.array(attachmentSchema).default([]),
  }),
});

export type NotificationEvent = z.infer<typeof notificationEventSchema>;
