import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Test } from '@nestjs/testing';
import { AcpxRuntime, createAcpRuntime } from 'acpx/runtime';
import { excalidrawMcpPath } from '../canvas/excalidraw.js';
import { CHOIR_CONFIG, choirConfigFrom } from '../choir/choir-config.js';
import { ChoirModule } from '../choir/choir.module.js';
import { findExecutable } from '../choir/executable.js';
import { AgentModule } from './agent.module.js';
import { AgentService } from './agent.service.js';

vi.mock('acpx/runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('acpx/runtime')>();
  return {
    ...original,
    createAcpRuntime: vi.fn<typeof original.createAcpRuntime>(
      original.createAcpRuntime,
    ),
  };
});

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-agent-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('configures the agent from the environment', async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [ChoirModule, AgentModule],
  }).compile();
  expect(moduleRef.get(CHOIR_CONFIG)).toEqual({
    ...choirConfigFrom(process.env),
    claudeExecutable: findExecutable('claude', process.env.PATH),
  });
  expect(moduleRef.get(AgentService)).toBeInstanceOf(AgentService);
  await moduleRef.close();
});

it('fails to read a session that was never saved', async () => {
  const agent = new AgentService({
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  });
  const handle = {
    sessionKey: 'c1',
    backend: 'acpx',
    runtimeSessionName: 'c1',
  };
  await expect(agent.record(handle)).rejects.toThrow('No saved session for c1');
  await expect(
    agent.record({ ...handle, acpxRecordId: 'missing' }),
  ).rejects.toThrow('No saved session for c1');
  await agent.onApplicationShutdown();
});

it('runs sessions with the profile and the installed Claude Code', async () => {
  const config = {
    dataDir,
    coreUrl: 'http://localhost:3100',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  };
  const withClaude = new AgentService({
    ...config,
    claudeExecutable: '/bin/claude',
  });
  const withoutClaude = new AgentService(config);
  const environments = vi
    .mocked(createAcpRuntime)
    .mock.calls.slice(-2)
    .map(([options]) => options.agentProcessEnv);
  const profile = path.join(dataDir, 'profiles', 'default');
  expect(environments).toEqual([
    {
      CLAUDE_CODE_PLUGIN_DIRS: profile,
      CHOIR_CORE_URL: 'http://localhost:3100',
      CLAUDE_CODE_EXECUTABLE: '/bin/claude',
    },
    {
      CLAUDE_CODE_PLUGIN_DIRS: profile,
      CHOIR_CORE_URL: 'http://localhost:3100',
    },
  ]);
  await withClaude.onApplicationShutdown();
  await withoutClaude.onApplicationShutdown();
});

it('stops its sessions when the app shuts down', async () => {
  const shutdown = vi.spyOn(AcpxRuntime.prototype, 'shutdown');
  await new AgentService({
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  }).onApplicationShutdown();
  expect(shutdown).toHaveBeenCalledOnce();
});

it('gives every session the Excalidraw MCP server of the canvas', async () => {
  const agent = new AgentService({
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3200',
    canvasPublicUrl: 'http://127.0.0.1:3200',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  });
  const [options] = vi.mocked(createAcpRuntime).mock.calls.at(-1) ?? [];
  expect(options?.mcpServers).toEqual([
    {
      name: 'excalidraw',
      command: process.execPath,
      args: [excalidrawMcpPath()],
      env: [
        { name: 'EXPRESS_SERVER_URL', value: 'http://127.0.0.1:3200' },
        { name: 'EXCALIDRAW_NO_AUTOSTART', value: '1' },
      ],
    },
  ]);
  expect(excalidrawMcpPath()).toMatch(
    /mcp-excalidraw-server\/dist\/index\.js$/,
  );
  await agent.onApplicationShutdown();
});
