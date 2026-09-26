import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { E2E_DATA_DIR } from './data-dir.js';

const INSTRUCTIONS = `When the user says a sentence, count its words with the Bash tool before you answer, then tell the user how many words it has.
`;

export default async function globalSetup(): Promise<void> {
  const folder = path.join(E2E_DATA_DIR, 'default');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'CLAUDE.md'), INSTRUCTIONS);
}
