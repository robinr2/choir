import path from 'node:path';
import { z } from 'zod';

export const folderPathSchema = z
  .string()
  .refine((value) => path.isAbsolute(value));

export const folderQuerySchema = z.object({
  path: folderPathSchema.optional(),
});

export type FolderQuery = z.infer<typeof folderQuerySchema>;
