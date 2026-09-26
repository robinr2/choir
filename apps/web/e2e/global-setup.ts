import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { E2E_DATA_DIR } from './data-dir.js';

export default async function globalSetup(): Promise<void> {
  await rm(E2E_DATA_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_DATA_DIR, 'default'), { recursive: true });
}
