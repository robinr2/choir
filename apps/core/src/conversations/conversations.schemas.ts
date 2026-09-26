import { z } from 'zod';

export const conversationIdSchema = z.uuid();

export const userTurnSchema = z.object({
  text: z.string().trim().min(1),
  early: z.boolean().optional(),
  voice: z.boolean().optional(),
});

export type UserTurn = z.infer<typeof userTurnSchema>;

export const interruptionSchema = z.object({ heard: z.string() });

export type Interruption = z.infer<typeof interruptionSchema>;

export const submittedPromptSchema = z.object({ prompt: z.string() });

export type SubmittedPrompt = z.infer<typeof submittedPromptSchema>;
