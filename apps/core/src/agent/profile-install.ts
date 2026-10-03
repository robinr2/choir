import { constants, copyFile, cp, mkdir } from 'node:fs/promises';

export type ProfileFiles = {
  template: string;
  dir: string;
  editable: { from: string; to: string };
  folder: string;
};

function keepExisting(error: NodeJS.ErrnoException): void {
  if (error.code !== 'EEXIST') throw error;
}

export async function installProfile({
  template,
  dir,
  editable,
  folder,
}: ProfileFiles): Promise<void> {
  await cp(template, dir, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
  await copyFile(editable.from, editable.to, constants.COPYFILE_EXCL).catch(
    keepExisting,
  );
  await mkdir(folder, { recursive: true });
}
