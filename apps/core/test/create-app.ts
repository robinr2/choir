import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { CHOIR_CONFIG, type ChoirConfig } from '../src/choir/choir-config.js';

const MOCK_AGENT = path.resolve(
  import.meta.dirname,
  '../node_modules/acpx-mock-agent/test/mock-agent.ts',
);

const MOCK_AGENT_COMMAND = [
  process.execPath,
  fileURLToPath(import.meta.resolve('tsx/cli')),
  MOCK_AGENT,
  '--supports-load-session',
];

export function createDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'choir-core-'));
}

export function removeDataDir(dataDir: string): Promise<void> {
  return rm(dataDir, { recursive: true, force: true });
}

export function freeCanvasUrl(): Promise<string> {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address?.port;
      server.close(() => resolve(`http://127.0.0.1:${port}`));
    });
  });
}

export async function createApp(
  dataDir: string,
  canvasUrl: string,
): Promise<INestApplication<App>> {
  const config: ChoirConfig = {
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl,
    agentCommand: MOCK_AGENT_COMMAND,
  };
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(CHOIR_CONFIG)
    .useValue(config)
    .compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}
