import { z } from 'zod';

const PREVIEW_WORDS = 10;

export function preview(text: string): string {
  const words = text.split(/\s/).filter(Boolean);
  const start = words.slice(0, PREVIEW_WORDS).join(' ');
  return words.length > PREVIEW_WORDS ? `${start} …` : start;
}

export function containing(search: string): string {
  return `%${search.replaceAll(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export const listQuerySchema = z.object({
  archived: z.stringbool().default(false),
  search: z.string().trim().default(''),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export const entryIdSchema = z.uuid();

export const archivedSchema = z.object({ archived: z.boolean() });

export type ArchivedChange = z.infer<typeof archivedSchema>;

export const placementSchema = z.union([
  z.strictObject({ before: entryIdSchema }),
  z.strictObject({ after: entryIdSchema }),
]);

export type Placement = z.infer<typeof placementSchema>;
