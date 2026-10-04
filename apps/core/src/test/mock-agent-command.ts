import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function mockAgentCommand(
  sessions: string,
  ...flags: string[]
): string[] {
  return [
    process.execPath,
    fileURLToPath(import.meta.resolve('tsx/cli')),
    path.resolve(import.meta.dirname, '../../test/mock-agent.ts'),
    '--sessions',
    sessions,
    ...flags,
  ];
}
