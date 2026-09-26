import { accessSync, constants } from 'node:fs';
import path from 'node:path';

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function findExecutable(
  name: string,
  searchPath?: string,
): string | undefined {
  return searchPath
    ?.split(path.delimiter)
    .filter((folder) => path.isAbsolute(folder))
    .map((folder) => path.join(folder, name))
    .find(isExecutable);
}
