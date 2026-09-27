import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CHOIR_CONFIG, type ChoirConfig } from '../choir/choir-config.js';
import type { TurnMark } from './transcript.js';

const marksSchema = z.record(
  z.string(),
  z.object({
    voice: z.literal(true).optional(),
    aloud: z.literal(true).optional(),
    from: z.object({ id: z.string(), name: z.string() }).optional(),
    text: z.string().optional(),
  }),
);

function missing(error: NodeJS.ErrnoException): string {
  if (error.code !== 'ENOENT') throw error;
  return '{}';
}

@Injectable()
export class TurnMarksService {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

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
    return path.join(
      this.config.dataDir,
      'turn-marks',
      `${conversationId}.json`,
    );
  }
}
