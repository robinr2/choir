import { z } from 'zod';
import {
  agentIdSchema,
  agentNameSchema,
  edgeSchema,
  layoutSchema,
  splitKindSchema,
} from '../layout/layout.schemas.js';

export const splitRequestSchema = z.object({
  agentId: agentIdSchema,
  direction: splitKindSchema,
  name: agentNameSchema.optional(),
});

export type SplitRequest = z.infer<typeof splitRequestSchema>;

export const edgeRequestSchema = z.object({
  edge: edgeSchema,
  name: agentNameSchema.optional(),
});

export type EdgeRequest = z.infer<typeof edgeRequestSchema>;

export const swapRequestSchema = z.object({
  first: agentIdSchema,
  second: agentIdSchema,
});

export type SwapRequest = z.infer<typeof swapRequestSchema>;

export const layoutRequestSchema = z.object({ layout: layoutSchema });

export type LayoutRequest = z.infer<typeof layoutRequestSchema>;

export const renameRequestSchema = z.object({ name: agentNameSchema });

export type RenameRequest = z.infer<typeof renameRequestSchema>;

export const voiceRequestSchema = z.object({
  agentId: agentIdSchema.nullable(),
});

export type VoiceRequest = z.infer<typeof voiceRequestSchema>;
