import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lastValueFrom } from 'rxjs';
import type { ChoirConfig } from '../choir/choir-config.js';
import { mockAgentCommand } from '../test/mock-agent-command.js';
import { AgentCatalogService } from './agent-catalog.service.js';
import { AgentConnection } from './agent-connection.js';
import { AgentSession } from './agent-session.js';

vi.setConfig({ testTimeout: 60_000 });

let dataDir: string;
let opened: { close(): Promise<void> }[];

function config(agentCommand?: string[]): ChoirConfig {
  return {
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3200',
    canvasPublicUrl: 'http://127.0.0.1:3200',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
    projectDir: dataDir,
    agentCommand: agentCommand ?? mockAgentCommand(sessionsDir()),
  };
}

function sessionsDir(): string {
  return path.join(dataDir, 'sessions');
}

function catalogService(agentCommand?: string[]): AgentCatalogService {
  const catalog = new AgentCatalogService(config(agentCommand));
  opened.push({ close: () => catalog.beforeApplicationShutdown() });
  return catalog;
}

async function sessionSaying(text: string): Promise<string> {
  const session = new AgentSession({
    command: mockAgentCommand(sessionsDir()),
    cwd: dataDir,
    env: {},
  });
  opened.push(session);
  await session.start({ cwd: dataDir, mcpServers: [] });
  await lastValueFrom(session.startTurn({ text }).updates);
  return session.id;
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-catalog-'));
  opened = [];
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(opened.map((each) => each.close()));
  await rm(dataDir, { recursive: true, force: true });
});

it('learns the models with their efforts and the modes from a probe session, once', async () => {
  const catalog = catalogService();
  const learned = catalog.catalog();
  expect(catalog.catalog()).toBe(learned);
  expect(await learned).toEqual({
    models: [
      {
        value: 'default',
        name: 'Default',
        description: 'Opus 4.8',
        efforts: [
          { value: 'default', name: 'Default' },
          { value: 'low', name: 'Low' },
          { value: 'high', name: 'High' },
        ],
      },
      {
        value: 'opus',
        name: 'Opus 4.8',
        description: 'Most capable',
        efforts: [
          { value: 'default', name: 'Default' },
          { value: 'low', name: 'Low' },
          { value: 'medium', name: 'Medium' },
          { value: 'high', name: 'High' },
          { value: 'max', name: 'Max' },
        ],
      },
      { value: 'haiku', name: 'Haiku 4.5', description: null, efforts: [] },
    ],
    modes: [
      { value: 'default', name: 'Manual', description: 'Always ask' },
      { value: 'plan', name: 'Plan', description: null },
      {
        value: 'bypassPermissions',
        name: 'Bypass permissions',
        description: 'Accepts all permissions',
      },
    ],
    defaults: {
      cwd: dataDir,
      model: 'default',
      effort: 'default',
      mode: 'bypassPermissions',
    },
  });
});

it('offers no models or modes for an agent without config options', async () => {
  const catalog = catalogService(
    mockAgentCommand(sessionsDir(), '--no-config-options'),
  );
  expect(await catalog.catalog()).toEqual({
    models: [],
    modes: [],
    defaults: {
      cwd: dataDir,
      model: null,
      effort: null,
      mode: 'bypassPermissions',
    },
  });
});

it('lists, forks and deletes the sessions of every folder', async () => {
  const catalog = catalogService();
  const first = await sessionSaying('echo one');
  const second = await sessionSaying('echo two');
  const third = await sessionSaying('echo three');
  const listed = await catalog.sessions();
  expect(listed).toHaveLength(3);
  expect(listed).toEqual(
    expect.arrayContaining([
      {
        sessionId: first,
        cwd: dataDir,
        title: 'echo one',
        updatedAt: expect.any(String),
      },
      {
        sessionId: second,
        cwd: dataDir,
        title: 'echo two',
        updatedAt: expect.any(String),
      },
      {
        sessionId: third,
        cwd: dataDir,
        title: 'echo three',
        updatedAt: expect.any(String),
      },
    ]),
  );
  const forked = await catalog.fork(first, dataDir);
  await catalog.delete(second);
  const ids = (await catalog.sessions()).map(({ sessionId }) => sessionId);
  expect(ids.toSorted()).toEqual([first, third, forked].toSorted());
});

it('lists sessions without a title or a time of change', async () => {
  const catalog = catalogService();
  await catalog.catalog();
  const [probe] = await catalog.sessions();
  expect(probe).toEqual({
    sessionId: expect.any(String),
    cwd: dataDir,
    title: null,
    updatedAt: null,
  });
});

it('stops its agent when the app shuts down and starts it again when needed', async () => {
  const close = vi.spyOn(AgentConnection.prototype, 'close');
  const catalog = catalogService();
  await catalog.beforeApplicationShutdown();
  expect(close).not.toHaveBeenCalled();
  expect(await catalog.sessions()).toEqual([]);
  await catalog.beforeApplicationShutdown();
  expect(close).toHaveBeenCalledOnce();
  await vi.waitFor(async () => expect(await catalog.sessions()).toEqual([]));
});

it('tries again to learn the catalog when the agent fails', async () => {
  const catalog = catalogService(['/nonexistent/agent']);
  await expect(catalog.catalog()).rejects.toThrow('ACP connection closed');
  await expect(catalog.catalog()).rejects.toThrow('ACP connection closed');
});
