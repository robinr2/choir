import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { CHOIR_CONFIG, type ChoirConfig } from '../choir/choir-config.js';

function missing(error: NodeJS.ErrnoException): string {
  if (error.code !== 'ENOENT') throw error;
  return '[]';
}

@Injectable()
export class VoiceTurnsService {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async load(conversationId: string): Promise<Set<string>> {
    const saved = await readFile(this.file(conversationId), 'utf8').catch(
      missing,
    );
    return new Set<string>(JSON.parse(saved));
  }

  async save(conversationId: string, prompts: Set<string>): Promise<void> {
    await mkdir(path.dirname(this.file(conversationId)), { recursive: true });
    await writeFile(this.file(conversationId), JSON.stringify([...prompts]));
  }

  private file(conversationId: string): string {
    return path.join(
      this.config.dataDir,
      'voice-turns',
      `${conversationId}.json`,
    );
  }
}
