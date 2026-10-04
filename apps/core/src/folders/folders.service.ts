import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  sessionFolder,
} from '../choir/choir-config.js';

type Folder = { name: string; path: string };

export type FolderListing = {
  path: string;
  parent: string | null;
  folders: Folder[];
};

function isFolder(entry: Dirent): boolean {
  return entry.isDirectory() && !entry.name.startsWith('.');
}

@Injectable()
export class FoldersService {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async list(requested?: string): Promise<FolderListing> {
    const folder = path.resolve(requested ?? sessionFolder(this.config));
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => {
      throw new BadRequestException(`There is no folder ${folder}`);
    });
    const parent = path.dirname(folder);
    return {
      path: folder,
      parent: parent === folder ? null : parent,
      folders: entries
        .filter(isFolder)
        .map(({ name }) => ({ name, path: path.join(folder, name) }))
        .toSorted((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
