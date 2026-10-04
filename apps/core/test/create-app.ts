import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './../src/app.module.js';
import { setUpApp } from '../src/app-setup.js';
import { CHOIR_CONFIG, type ChoirConfig } from '../src/choir/choir-config.js';
import { JUDGE, type Judge } from '../src/judge/judge.port.js';
import { mockAgentCommand } from '../src/test/mock-agent-command.js';

export const CANVAS_PUBLIC_URL = 'https://choir.example/canvas';

export function createDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'choir-core-'));
}

export function removeDataDir(dataDir: string): Promise<void> {
  return rm(dataDir, { recursive: true, force: true });
}

export type TestPaths = {
  dataDir: string;
  canvasUrl: string;
  databaseUrl: string;
  judge: Judge;
};

export async function createApp({
  dataDir,
  canvasUrl,
  databaseUrl,
  judge,
}: TestPaths): Promise<NestExpressApplication> {
  const config: ChoirConfig = {
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl,
    canvasPublicUrl: CANVAS_PUBLIC_URL,
    databaseUrl,
    claudeDir: path.join(dataDir, 'claude'),
    agentCommand: mockAgentCommand(path.join(dataDir, 'claude', 'sessions')),
  };
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(CHOIR_CONFIG)
    .useValue(config)
    .overrideProvider(JUDGE)
    .useValue(judge)
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  setUpApp(app);
  await app.init();
  return app;
}
