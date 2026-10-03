import { z } from 'zod';
import { entryIdSchema } from './listing.js';

const titleSchema = z.string().trim().min(1).max(200);

const dueAtSchema = z.iso.datetime({ offset: true }).nullable();

export const newTodoSchema = z.object({
  title: titleSchema,
  description: z.string().default(''),
  dueAt: dueAtSchema.default(null),
  notificationIds: z.array(entryIdSchema).default([]),
});

export type NewTodo = z.infer<typeof newTodoSchema>;

export const todoChangeSchema = z.object({
  title: titleSchema.optional(),
  description: z.string().optional(),
  dueAt: dueAtSchema.optional(),
  archived: z.boolean().optional(),
});

export type TodoChange = z.infer<typeof todoChangeSchema>;

export const linkSchema = z.object({ notificationId: entryIdSchema });

export type Link = z.infer<typeof linkSchema>;

export function instant(time: string | null): Temporal.Instant | null {
  return time === null ? null : Temporal.Instant.from(time);
}
