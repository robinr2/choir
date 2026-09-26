import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  workspaceFile,
} from '../choir/choir-config.js';
import { type WorkspaceState, workspaceStateSchema } from './layout.schemas.js';

function missing(error: NodeJS.ErrnoException): undefined {
  if (error.code !== 'ENOENT') throw error;
  return undefined;
}

@Injectable()
export class LayoutStore {
  private saving = Promise.resolve();

  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async load(): Promise<WorkspaceState | undefined> {
    const saved = await readFile(this.file, 'utf8').catch(missing);
    return saved === undefined
      ? undefined
      : workspaceStateSchema.parse(JSON.parse(saved));
  }

  save(state: WorkspaceState): Promise<void> {
    const saved = JSON.stringify(state);
    const write = async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, saved);
    };
    this.saving = this.saving.then(write, write);
    return this.saving;
  }

  private get file(): string {
    return workspaceFile(this.config);
  }
}
