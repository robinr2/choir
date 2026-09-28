import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpxRuntime, createAcpRuntime } from 'acpx/runtime';
import { type ChoirConfig, judgeTranscripts } from '../choir/choir-config.js';
import { ClaudeJudge } from './claude-judge.js';

vi.mock('acpx/runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('acpx/runtime')>();
  return {
    ...original,
    createAcpRuntime: vi.fn<typeof original.createAcpRuntime>(
      original.createAcpRuntime,
    ),
  };
});

const MOCK_AGENT = [
  process.execPath,
  fileURLToPath(import.meta.resolve('tsx/cli')),
  path.resolve(
    import.meta.dirname,
    '../../node_modules/acpx-mock-agent/test/mock-agent.ts',
  ),
];

const PROMPT = 'Judge the inbox.';

let dataDir: string;
let config: ChoirConfig;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-judge-'));
  config = {
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: path.join(dataDir, 'claude'),
    agentCommand: MOCK_AGENT,
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

it(
  'judges each notification in a fresh session with the judge prompt and removes it afterwards',
  { timeout: 30_000 },
  async () => {
    const ensure = vi.spyOn(AcpxRuntime.prototype, 'ensureSession');
    const mode = vi.spyOn(AcpxRuntime.prototype, 'setMode');
    const turns = vi.spyOn(AcpxRuntime.prototype, 'startTurn');
    const close = vi.spyOn(AcpxRuntime.prototype, 'close');
    await mkdir(judgeTranscripts(config), { recursive: true });
    const claude = judge();
    const [[{ sessionStore }]] = vi
      .mocked(createAcpRuntime)
      .mock.calls.slice(-1);
    await claude.judge('n1');
    const [[ensured]] = ensure.mock.calls;
    expect(ensured).toEqual({
      sessionKey: expect.any(String),
      agent: 'claude',
      mode: 'oneshot',
      cwd: path.join(dataDir, 'judge'),
      sessionOptions: {
        systemPrompt: { append: PROMPT },
        env: { CHOIR_CONVERSATION_ID: ensured.sessionKey },
      },
    });
    const [[{ handle }]] = mode.mock.calls;
    expect(mode).toHaveBeenCalledWith({ handle, mode: 'bypassPermissions' });
    const [[turn]] = turns.mock.calls;
    expect(turn).toMatchObject({
      text: 'Judge the notification n1.',
      mode: 'prompt',
    });
    expect(close).toHaveBeenCalledWith({
      handle,
      reason: 'The judge has decided',
    });
    expect(
      await sessionStore.load(String(handle.acpxRecordId)),
    ).toBeUndefined();
    expect(await exists(judgeTranscripts(config))).toBe(false);
    await claude.judge('n2');
    const [, [again]] = ensure.mock.calls;
    expect(again.sessionKey).not.toBe(ensured.sessionKey);
    await claude.onApplicationShutdown();
  },
);

it('fails when the judge does not finish and removes the session all the same', async () => {
  const close = vi.spyOn(AcpxRuntime.prototype, 'close');
  const failed: ReturnType<AcpxRuntime['startTurn']> = {
    requestId: 'r1',
    promptStarted: Promise.resolve(),
    events: { [Symbol.asyncIterator]: async function* () {} },
    result: Promise.resolve({
      status: 'failed',
      error: { message: 'usage limit' },
    }),
    cancel: async () => undefined,
    closeStream: async () => undefined,
  };
  vi.spyOn(AcpxRuntime.prototype, 'startTurn').mockReturnValueOnce(failed);
  const claude = judge();
  await expect(claude.judge('n1')).rejects.toThrow(
    'The judge ended failed: {"status":"failed","error":{"message":"usage limit"}}',
  );
  expect(close).toHaveBeenCalledOnce();
  await claude.onApplicationShutdown();
});

it('fails when Claude Code cannot start', async () => {
  const claude = judge({
    agentCommand: [...MOCK_AGENT, '--set-session-mode-fails'],
  });
  await expect(claude.judge('n1')).rejects.toThrow('Internal error');
  await claude.onApplicationShutdown();
});

it('runs the judge with its own profile and the installed Claude Code', async () => {
  const shutdown = vi.spyOn(AcpxRuntime.prototype, 'shutdown');
  const judges = [judge({ claudeExecutable: '/bin/claude' }), judge()];
  const options = vi
    .mocked(createAcpRuntime)
    .mock.calls.slice(-2)
    .map(([option]) => option);
  const profile = path.join(dataDir, 'profiles', 'judge');
  expect(options.map(({ agentProcessEnv }) => agentProcessEnv)).toEqual([
    {
      CLAUDE_CODE_PLUGIN_DIRS: profile,
      CHOIR_CORE_URL: 'http://localhost:3000',
      CLAUDE_CODE_EXECUTABLE: '/bin/claude',
    },
    {
      CLAUDE_CODE_PLUGIN_DIRS: profile,
      CHOIR_CORE_URL: 'http://localhost:3000',
    },
  ]);
  expect(options[0]).toMatchObject({
    cwd: path.join(dataDir, 'judge'),
    permissionMode: 'approve-all',
  });
  await Promise.all(judges.map((each) => each.onApplicationShutdown()));
  expect(shutdown).toHaveBeenCalledTimes(2);
});
