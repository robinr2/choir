import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { inject } from 'vitest';

async function administer(statement: string): Promise<void> {
  const url = new URL(inject('databaseUrl'));
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

export async function createDatabase(): Promise<string> {
  const template = new URL(inject('databaseUrl'));
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  await administer(
    `CREATE DATABASE ${name} TEMPLATE "${template.pathname.slice(1)}"`,
  );
  template.pathname = `/${name}`;
  return template.href;
}

export async function dropDatabase(url: string): Promise<void> {
  const name = new URL(url).pathname.slice(1);
  await administer(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
}
