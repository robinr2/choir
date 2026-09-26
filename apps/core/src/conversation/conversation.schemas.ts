import { z } from 'zod';

export const userTurnSchema = z.object({ text: z.string().trim().min(1) });

export type UserTurn = z.infer<typeof userTurnSchema>;

export const interruptionSchema = z.object({ heard: z.string() });

export type Interruption = z.infer<typeof interruptionSchema>;
