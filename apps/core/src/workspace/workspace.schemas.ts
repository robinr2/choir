import { z } from 'zod';
import { folderPathSchema } from '../folders/folders.schemas.js';
import { agentNameSchema, paneIdSchema } from '../layout/layout.schemas.js';

const settingSchema = z.string().trim().min(1).optional();

const launchSchema = z.union([
  z.strictObject({
    resume: z.uuid(),
    cwd: folderPathSchema,
    fork: z.boolean().optional(),
  }),
  z.strictObject({
    cwd: folderPathSchema,
    model: settingSchema,
    effort: settingSchema,
    mode: settingSchema,
  }),
]);

export const contentRequestSchema = z.union([
  z.object({ kind: z.literal('excalidraw') }),
  z.object({ kind: z.literal('agent'), launch: launchSchema.optional() }),
]);

export type ContentRequest = z.infer<typeof contentRequestSchema>;

const conversationPaneSchema = z.object({
  conversationId: paneIdSchema,
  nextTo: paneIdSchema,
});

export const newPaneSchema = z
  .union([conversationPaneSchema, z.strictObject({})])
  .optional();

export type NewPaneRequest = z.infer<typeof newPaneSchema>;

export const renameRequestSchema = z.object({ name: agentNameSchema });

export type RenameRequest = z.infer<typeof renameRequestSchema>;

export const voiceRequestSchema = z.object({
  agentId: paneIdSchema.nullable(),
});

export type VoiceRequest = z.infer<typeof voiceRequestSchema>;
