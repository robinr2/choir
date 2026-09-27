import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import {
  canvasDir,
  CHOIR_CONFIG,
  type ChoirConfig,
} from '../choir/choir-config.js';

const EXTENSION = '.excalidraw';

export const KEPT_VERSIONS = 10;

function versionName(): string {
  return `${new Date().toISOString().replaceAll(':', '-')}${EXTENSION}`;
}

@Injectable()
export class CanvasHistory {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async versions(): Promise<string[]> {
    await mkdir(this.folder, { recursive: true });
    const names = await readdir(this.folder);
    return names.filter((name) => name.endsWith(EXTENSION)).toSorted();
  }

  async latest(): Promise<string | undefined> {
    const newest = (await this.versions()).at(-1);
    return newest && readFile(path.join(this.folder, newest), 'utf8');
  }

  async save(scene: string): Promise<void> {
    const earlier = await this.versions();
    const saved = versionName();
    await writeFile(path.join(this.folder, saved), scene);
    const dropped = [...earlier, saved].slice(0, -KEPT_VERSIONS);
    await Promise.all(dropped.map((name) => rm(path.join(this.folder, name))));
  }

  private get folder(): string {
    return canvasDir(this.config);
  }
}
