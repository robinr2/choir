import { mkdir, mkdtemp, rm } from 'node:fs/promises';
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
import { AgentCatalogService } from './agent-catalog.service.js';
import type { AgentLink } from './agent-links.js';
import type { AgentLinksStore } from './agent-links.store.js';
import { AgentModule } from './agent.module.js';
import { AgentService } from './agent.service.js';
import type { AgentSession } from './agent-session.js';

vi.setConfig({ testTimeout: 60_000 });

let dataDir: string;
let links: Map<string, AgentLink>;
let catalogs: AgentCatalogService[];

const store = {
  find: vi.fn<AgentLinksStore['find']>(async (id) => links.get(id)),
  save: vi.fn<AgentLinksStore['save']>(async (link) => {
    links.set(link.conversationId, link);
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

function service(...flags: string[]): AgentService {
  const catalog = new AgentCatalogService(config());
  catalogs.push(catalog);
  return new AgentService(config(...flags), store, catalog);
}

async function said(session: AgentSession, text: string): Promise<string> {
  return lastValueFrom(
    session
      .startTurn({ text })
      .updates.pipe(
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
  catalogs = [];
  vi.clearAllMocks();
});

afterEach(async () => {
  await Promise.all(
    catalogs.map((catalog) => catalog.beforeApplicationShutdown()),
  );
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

it('starts a session in the default folder for a new conversation and loads it when the conversation reopens', async () => {
  const agent = service();
  const session = await agent.open('c1');
  expect(store.save).toHaveBeenCalledExactlyOnceWith({
    conversationId: 'c1',
    sessionId: session.id,
    cwd: dataDir,
    model: null,
    effort: null,
    mode: null,
  });
  expect(JSON.parse(await said(session, 'session-setup'))).toEqual({
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
      claudeCode: {
        options: {
          settingSources: ['project', 'local'],
          thinking: { type: 'adaptive', display: 'summarized' },
        },
      },
    },
  });
  await agent.close(session);
  const reopened = await agent.open('c1');
  expect(store.save).toHaveBeenCalledOnce();
  expect(reopened.id).toBe(session.id);
  expect(await said(reopened, 'env CHOIR_CONVERSATION_ID')).toBe('c1');
  expect(await said(reopened, 'env CLAUDE_CODE_FORK_SUBAGENT')).toBe('1');
  await agent.beforeApplicationShutdown();
});

it('starts a launched session in its folder with its model, effort and mode', async () => {
  const agent = service();
  const folder = path.join(dataDir, 'project');
  await mkdir(folder);
  await agent.launch('c1', {
    cwd: folder,
    model: 'opus',
    effort: 'max',
    mode: 'plan',
  });
  const session = await agent.open('c1');
  expect(JSON.parse(await said(session, 'config'))).toEqual({
    mode: 'plan',
    model: 'opus',
    effort: 'max',
    fast: false,
  });
  expect(await said(session, 'cwd')).toBe(folder);
  expect(links.get('c1')).toEqual({
    conversationId: 'c1',
    sessionId: session.id,
    cwd: folder,
    model: 'opus',
    effort: 'max',
    mode: 'plan',
  });
  await agent.beforeApplicationShutdown();
});

it('resumes a session as it is or as a fork of it', async () => {
  const agent = service();
  const original = await agent.open('c1');
  await said(original, 'echo hi');
  await agent.launch('c2', { resume: original.id, cwd: dataDir });
  const resumed = await agent.open('c2');
  expect(resumed.id).toBe(original.id);
  await agent.launch('c3', { resume: original.id, cwd: dataDir, fork: true });
  const forked = await agent.open('c3');
  expect(forked.id).not.toBe(original.id);
  expect(forked.history).toHaveLength(2);
  expect(await said(forked, 'mode')).toBe('bypassPermissions');
  await agent.link('c4', forked.id, dataDir);
  expect(links.get('c4')).toEqual({
    conversationId: 'c4',
    sessionId: forked.id,
    cwd: dataDir,
    model: null,
    effort: null,
    mode: null,
  });
  await agent.beforeApplicationShutdown();
});

it('stops the sessions still open when the app shuts down, and each only once', async () => {
  const agent = service();
  const closed = await agent.open('c1');
  const open = await agent.open('c2');
  const close = vi.spyOn(closed, 'close');
  await agent.close(closed);
  await agent.beforeApplicationShutdown();
  expect(close).toHaveBeenCalledOnce();
  await expect(open.startTurn({ text: 'echo late' }).result).rejects.toThrow(
    'ACP connection closed',
  );
});

it('stops the agent of a session that cannot start', async () => {
  const agent = service('--set-config-fails');
  await expect(agent.open('c1')).rejects.toThrow('Internal error');
  await agent.beforeApplicationShutdown();
});
