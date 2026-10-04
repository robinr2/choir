import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const marksSchema = z.record(
  z.string(),
  z.object({
    voice: z.literal(true).optional(),
    aloud: z.literal(true).optional(),
    from: z.object({ id: z.string(), name: z.string() }).optional(),
    text: z.string().optional(),
    heard: z.string().optional(),
  }),
);

type TurnMark = z.infer<typeof marksSchema>[string];

function missing(error: NodeJS.ErrnoException): string {
  if (error.code !== 'ENOENT') throw error;
  return '{}';
}

export class TurnMarks {
  constructor(private readonly dir: string) {}

  async load(conversationId: string): Promise<Map<string, TurnMark>> {
    const saved = await readFile(this.file(conversationId), 'utf8').catch(
      missing,
    );
    return new Map(Object.entries(marksSchema.parse(JSON.parse(saved))));
  }

  async save(
    conversationId: string,
    marks: ReadonlyMap<string, TurnMark>,
  ): Promise<void> {
    await mkdir(path.dirname(this.file(conversationId)), { recursive: true });
    await writeFile(
      this.file(conversationId),
      JSON.stringify(Object.fromEntries(marks)),
    );
  }

  private file(conversationId: string): string {
    return path.join(this.dir, `${conversationId}.json`);
  }
}
