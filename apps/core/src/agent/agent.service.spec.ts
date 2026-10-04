import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Test } from '@nestjs/testing';
import { lastValueFrom, map } from 'rxjs';
import { excalidrawMcpPath } from '../canvas/excalidraw.js';
import type { ChoirConfig } from '../choir/choir-config.js';
import { CHOIR_CONFIG, choirConfigFrom } from '../choir/choir-config.js';
import { ChoirModule } from '../choir/choir.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { findExecutable } from '../choir/executable.js';
import { mockAgentCommand } from '../test/mock-agent-command.js';
import { AgentModule } from './agent.module.js';
import { AgentService } from './agent.service.js';
import type { AgentSessionsStore } from './agent-sessions.store.js';
import type { AgentTurn } from './prompt-turn.js';

vi.setConfig({ testTimeout: 60_000 });

let dataDir: string;
let links: Map<string, string>;

const store = {
  find: vi.fn<AgentSessionsStore['find']>(async (id) => links.get(id)),
  save: vi.fn<AgentSessionsStore['save']>(async (id, sessionId) => {
    links.set(id, sessionId);
  }),
};

function config(...flags: string[]): ChoirConfig {
  return {
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3200',
    canvasPublicUrl: 'http://127.0.0.1:3200',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
    projectDir: dataDir,
    agentCommand: mockAgentCommand(path.join(dataDir, 'sessions'), ...flags),
  };
}

function said(turn: AgentTurn): Promise<string> {
  return lastValueFrom(
    turn.updates.pipe(
      map((update) =>
        update.sessionUpdate === 'agent_message_chunk' &&
        update.content.type === 'text'
          ? update.content.text
          : '',
      ),
    ),
  );
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-agent-'));
  links = new Map();
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('configures the agent from the environment', async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [ChoirModule, DatabaseModule, AgentModule],
  }).compile();
  expect(moduleRef.get(CHOIR_CONFIG)).toEqual({
    ...choirConfigFrom(process.env),
    claudeExecutable: findExecutable('claude', process.env.PATH),
  });
  expect(moduleRef.get(AgentService)).toBeInstanceOf(AgentService);
  await moduleRef.close();
});

it('starts a session for a new conversation and loads it when the conversation reopens', async () => {
  const agent = new AgentService(config(), store);
  const session = await agent.open('c1');
  expect(store.save).toHaveBeenCalledExactlyOnceWith('c1', session.id);
  expect(JSON.parse(await said(session.startTurn('session-setup')))).toEqual({
    cwd: dataDir,
    mcpServers: [
      {
        name: 'excalidraw',
        command: process.execPath,
        args: [excalidrawMcpPath()],
        env: [
          { name: 'EXPRESS_SERVER_URL', value: 'http://127.0.0.1:3200' },
          { name: 'EXCALIDRAW_NO_AUTOSTART', value: '1' },
        ],
      },
    ],
    _meta: {
      claudeCode: { options: { settingSources: ['project', 'local'] } },
    },
  });
  await agent.close(session);
  const reopened = await agent.open('c1');
  expect(store.save).toHaveBeenCalledOnce();
  expect(reopened.history).toHaveLength(2);
  expect(await said(reopened.startTurn('env CHOIR_CONVERSATION_ID'))).toBe(
    'c1',
  );
  await agent.beforeApplicationShutdown();
});

it('stops the sessions still open when the app shuts down, and each only once', async () => {
  const agent = new AgentService(config(), store);
  const closed = await agent.open('c1');
  const open = await agent.open('c2');
  const close = vi.spyOn(closed, 'close');
  await agent.close(closed);
  await agent.beforeApplicationShutdown();
  expect(close).toHaveBeenCalledOnce();
  await expect(open.startTurn('echo late').result).rejects.toThrow(
    'ACP connection closed',
  );
});

it('stops the agent of a session that cannot start', async () => {
  const agent = new AgentService(config('--set-session-mode-fails'), store);
  await expect(agent.open('c1')).rejects.toThrow('Internal error');
  await agent.beforeApplicationShutdown();
});
