import { z } from 'zod';
import {
  agentNameSchema,
  openableKindSchema,
  paneIdSchema,
} from '../layout/layout.schemas.js';

export const contentRequestSchema = z.object({ kind: openableKindSchema });

export type ContentRequest = z.infer<typeof contentRequestSchema>;

export const renameRequestSchema = z.object({ name: agentNameSchema });

export type RenameRequest = z.infer<typeof renameRequestSchema>;

export const voiceRequestSchema = z.object({
  agentId: paneIdSchema.nullable(),
});

export type VoiceRequest = z.infer<typeof voiceRequestSchema>;
