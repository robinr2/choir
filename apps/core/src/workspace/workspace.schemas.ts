import { z } from 'zod';
import {
  agentNameSchema,
  edgeSchema,
  layoutSchema,
  openableKindSchema,
  paneIdSchema,
  splitKindSchema,
} from '../layout/layout.schemas.js';

export const splitRequestSchema = z.object({
  paneId: paneIdSchema,
  direction: splitKindSchema,
});

export type SplitRequest = z.infer<typeof splitRequestSchema>;

export const edgeRequestSchema = z.object({ edge: edgeSchema });

export type EdgeRequest = z.infer<typeof edgeRequestSchema>;

export const contentRequestSchema = z.object({ kind: openableKindSchema });

export type ContentRequest = z.infer<typeof contentRequestSchema>;

export const swapRequestSchema = z.object({
  first: paneIdSchema,
  second: paneIdSchema,
});

export type SwapRequest = z.infer<typeof swapRequestSchema>;

export const layoutRequestSchema = z.object({ layout: layoutSchema });

export type LayoutRequest = z.infer<typeof layoutRequestSchema>;

export const renameRequestSchema = z.object({ name: agentNameSchema });

export type RenameRequest = z.infer<typeof renameRequestSchema>;

export const voiceRequestSchema = z.object({
  agentId: paneIdSchema.nullable(),
});

export type VoiceRequest = z.infer<typeof voiceRequestSchema>;
