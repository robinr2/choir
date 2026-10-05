import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import { firstValueFrom, take, toArray } from 'rxjs';
import type { AgentCatalog } from '../agent/agent-catalog.js';
import type { AgentService } from '../agent/agent.service.js';
import type { AgentSession } from '../agent/agent-session.js';
import type { ChoirConfig } from '../choir/choir-config.js';
import type { RateLimitsService } from '../rate-limits/rate-limits.service.js';
import { ConversationHostService } from './conversation-host.service.js';

const CATALOG: AgentCatalog = {
  models: [],
  modes: [],
  defaults: { cwd: '/w', model: null, effort: null, mode: 'bypassPermissions' },
};

let dataDir: string;
const session = { close: vi.fn<() => Promise<void>>(async () => undefined) };
const opening = new Promise<AgentSession>(() => undefined);
const agent = {
  open: vi.fn<AgentService['open']>(() => opening),
  close: vi.fn<AgentService['close']>(async () => undefined),
  link: vi.fn<AgentService['link']>(async () => undefined),
  catalog: vi.fn<AgentService['catalog']>(async () => CATALOG),
  sessions: vi.fn<AgentService['sessions']>(async () => []),
  fork: vi.fn<AgentService['fork']>(async () => 's2'),
};
const rateLimits = { record: vi.fn<RateLimitsService['record']>() };
let host: ConversationHostService;

beforeEach(async () => {
  vi.clearAllMocks();
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-host-'));
  const config: ChoirConfig = {
    dataDir,
    coreUrl: 'http://core',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  };
  host = new ConversationHostService(agent, config, rateLimits);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dataDir, { recursive: true, force: true });
});

it('opens, closes, links, lists and forks sessions through the agent', async () => {
  expect(host.open('c1')).toBe(opening);
  await host.close(session);
  await host.link('c1', 's1', '/w');
  expect(await host.sessions()).toEqual([]);
  expect(await host.fork('s1', '/w')).toBe('s2');
  expect(agent.open).toHaveBeenCalledExactlyOnceWith('c1');
  expect(agent.close).toHaveBeenCalledExactlyOnceWith(session);
  expect(agent.link).toHaveBeenCalledExactlyOnceWith('c1', 's1', '/w');
  expect(agent.fork).toHaveBeenCalledExactlyOnceWith('s1', '/w');
});

it('learns the catalog and logs when it cannot', async () => {
  const error = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
  expect(await host.catalog()).toBe(CATALOG);
  agent.catalog.mockRejectedValueOnce(new Error('no agent'));
  expect(await host.catalog()).toBeNull();
  expect(error).toHaveBeenCalledExactlyOnceWith(
    'The agent catalog failed: Error: no agent',
  );
});

it('keeps the marks of a conversation in the data folder', async () => {
  await host.saveMarks('c1', new Map([['hi', { aloud: true }]]));
  expect(
    JSON.parse(
      await readFile(path.join(dataDir, 'turn-marks', 'c1.json'), 'utf8'),
    ),
  ).toEqual({ hi: { aloud: true } });
  expect(await host.loadMarks('c1')).toEqual(
    new Map([['hi', { aloud: true }]]),
  );
  expect(await host.loadMarks('c2')).toEqual(new Map());
});

it('records rate limits, logs turns and follows working agents', async () => {
  const update = { sessionUpdate: 'usage_update', used: 1, size: 2 } as const;
  host.usage(update);
  expect(rateLimits.record).toHaveBeenCalledExactlyOnceWith(update);
  const log = vi.spyOn(Logger.prototype, 'log').mockReturnValue();
  const error = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
  host.ended('c1', { summary: 'end_turn: fine' });
  host.ended('c1', { error: new Error('gone') });
  expect(log).toHaveBeenCalledExactlyOnceWith(
    'Conversation c1 turn end_turn: fine',
  );
  expect(error).toHaveBeenCalledExactlyOnceWith(
    'Conversation c1 turn failed: Error: gone',
  );
  const working = firstValueFrom(host.workingChanges.pipe(take(5), toArray()));
  const turn = Promise.withResolvers<void>();
  host.follow('c1', turn.promise);
  turn.resolve();
  await turn.promise;
  await new Promise(setImmediate);
  host.follow('c2', new Promise(() => undefined));
  host.forget('c2');
  expect(await working).toEqual([
    new Set(),
    new Set(['c1']),
    new Set(),
    new Set(['c2']),
    new Set(),
  ]);
});
