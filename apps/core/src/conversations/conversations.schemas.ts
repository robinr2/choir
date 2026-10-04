import { z } from 'zod';

export const conversationIdSchema = z.uuid();

const imagesSchema = z
  .array(
    z.object({
      data: z.base64().min(1),
      mimeType: z.string().regex(/^image\/[\w.+-]+$/),
    }),
  )
  .optional();

const textSchema = z.string().trim().min(1);

export const steeringSchema = z.object({
  text: textSchema,
  images: imagesSchema,
});

export type Steering = z.infer<typeof steeringSchema>;

export const userTurnSchema = steeringSchema.extend({
  early: z.boolean().optional(),
  voice: z.boolean().optional(),
});

export type UserTurn = z.infer<typeof userTurnSchema>;

export const interactionAnswerSchema = z.union([
  z.strictObject({ optionId: z.string().min(1) }),
  z.strictObject({
    action: z.literal('accept'),
    content: z
      .record(
        z.string(),
        z.union([z.string(), z.array(z.string()), z.boolean(), z.number()]),
      )
      .optional(),
  }),
  z.strictObject({ action: z.enum(['decline', 'cancel']) }),
]);

export type InteractionAnswerRequest = z.infer<typeof interactionAnswerSchema>;

const settingSchema = z.string().trim().min(1).optional();

export const settingsSchema = z
  .strictObject({
    model: settingSchema,
    effort: settingSchema,
    mode: settingSchema,
  })
  .refine((settings) => Object.keys(settings).length > 0, {
    message: 'Name a setting to change',
  });

export type SettingsRequest = z.infer<typeof settingsSchema>;

export const confirmationSchema = z.object({ text: z.string() });

export type Confirmation = z.infer<typeof confirmationSchema>;

export const interruptionSchema = z.object({ heard: z.string() });

export type Interruption = z.infer<typeof interruptionSchema>;

export const submittedPromptSchema = z.object({ prompt: z.string() });

export type SubmittedPrompt = z.infer<typeof submittedPromptSchema>;
