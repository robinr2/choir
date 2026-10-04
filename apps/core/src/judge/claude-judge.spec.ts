import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type ChoirConfig, judgeTranscripts } from '../choir/choir-config.js';
import { mockAgentCommand } from '../test/mock-agent-command.js';
import { AgentSession } from '../agent/agent-session.js';
import { ClaudeJudge } from './claude-judge.js';

vi.setConfig({ testTimeout: 60_000 });

const PROMPT = 'Judge the inbox.';

let dataDir: string;
let config: ChoirConfig;

function sessions(): string {
  return path.join(dataDir, 'sessions');
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-judge-'));
  config = {
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: path.join(dataDir, 'claude'),
    agentCommand: mockAgentCommand(sessions()),
  };
  await mkdir(path.join(dataDir, 'judge'), { recursive: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dataDir, { recursive: true, force: true });
});

function judge(overrides: Partial<ChoirConfig> = {}): ClaudeJudge {
  return new ClaudeJudge(
    { ...config, ...overrides },
    { systemPrompt: async () => PROMPT },
  );
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

type Saved = {
  setup: { cwd: string; mcpServers: unknown[]; _meta: unknown };
  updates: { sessionUpdate: string }[];
};

async function savedSessions(): Promise<Saved[]> {
  const files = await readdir(sessions()).catch(() => []);
  return Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(path.join(sessions(), file), 'utf8')),
    ),
  );
}

it('judges each notification in a fresh session with the judge prompt and removes its transcripts', async () => {
  await mkdir(judgeTranscripts(config), { recursive: true });
  const close = vi.spyOn(AgentSession.prototype, 'close');
  const claude = judge();
  await claude.judge('n1');
  expect(close).toHaveBeenCalledOnce();
  expect(await exists(judgeTranscripts(config))).toBe(false);
  await claude.judge('n2');
  const saved = await savedSessions();
  expect(saved).toHaveLength(2);
  expect(saved.map(({ updates: [first] }) => first)).toContainEqual({
    sessionUpdate: 'user_message_chunk',
    content: { type: 'text', text: 'Judge the notification n1.' },
  });
  expect(saved[0]?.setup).toEqual({
    cwd: path.join(dataDir, 'judge'),
    mcpServers: [],
    _meta: {
      claudeCode: { options: { settingSources: ['project', 'local'] } },
      systemPrompt: { append: PROMPT },
    },
  });
  await claude.beforeApplicationShutdown();
  expect(close).toHaveBeenCalledTimes(2);
});

it('fails when the judge does not finish its turn', async () => {
  const claude = judge({
    agentCommand: mockAgentCommand(sessions(), '--stop-reason', 'refusal'),
  });
  await expect(claude.judge('n1')).rejects.toThrow(
    'The judge ended: {"stopReason":"refusal"}',
  );
});

it('fails when Claude Code cannot start', async () => {
  const claude = judge({
    agentCommand: mockAgentCommand(sessions(), '--set-session-mode-fails'),
  });
  await expect(claude.judge('n1')).rejects.toThrow('Internal error');
});

it('stops a running judge when the app shuts down', async () => {
  const claude = judge({
    agentCommand: mockAgentCommand(
      sessions(),
      '--respond',
      'stream-sleep 60000 thinking',
    ),
  });
  const judging = claude.judge('n1');
  await vi.waitFor(
    async () => expect((await savedSessions())[0]?.updates).toHaveLength(2),
    { timeout: 30_000 },
  );
  await claude.beforeApplicationShutdown();
  await expect(judging).rejects.toThrow('ACP connection closed');
});
