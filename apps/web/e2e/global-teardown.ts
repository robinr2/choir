import { rm } from 'node:fs/promises';
import { E2E_DATA_DIR } from './data-dir.js';

export default async function globalTeardown(): Promise<void> {
  await rm(E2E_DATA_DIR, { recursive: true, force: true });
}
