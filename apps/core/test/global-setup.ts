import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const run = promisify(execFile);

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:17').start();
  const databaseUrl = container.getConnectionUri();
  await run('npx', ['prisma', 'db', 'migrate', '-q'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  project.provide('databaseUrl', databaseUrl);
  return async () => {
    await container.stop();
  };
}
