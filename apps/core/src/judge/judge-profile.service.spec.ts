import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JudgeProfileService } from './judge-profile.service.js';

const APP_ROOT = path.resolve(import.meta.dirname, '..', '..');

let dataDir: string;

function profileFile(...parts: string[]): string {
  return path.join(dataDir, 'profiles', 'judge', ...parts);
}

function profile(): JudgeProfileService {
  return new JudgeProfileService({
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  });
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-judge-profile-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('sets up the judge profile as a plugin that reaches choir, with the context about the user', async () => {
  await profile().onModuleInit();
  expect(
    JSON.parse(
      await readFile(profileFile('.claude-plugin', 'plugin.json'), 'utf8'),
    ),
  ).toEqual({
    name: 'choir-judge',
  });
  expect(JSON.parse(await readFile(profileFile('.mcp.json'), 'utf8'))).toEqual({
    mcpServers: {
      choir: {
        type: 'http',
        url: '${CHOIR_CORE_URL}/mcp',
        headers: { 'X-Choir-Agent': '${CHOIR_CONVERSATION_ID}' },
      },
    },
  });
  expect(await readFile(profileFile('judge-context.md'), 'utf8')).toBe(
    await readFile(path.join(APP_ROOT, 'default-judge-context.md'), 'utf8'),
  );
  expect((await stat(path.join(dataDir, 'judge'))).isDirectory()).toBe(true);
});

it('keeps the context the user has written and tells the judge what to do and about the user', async () => {
  await mkdir(profileFile(), { recursive: true });
  await writeFile(
    profileFile('judge-context.md'),
    'Sam leads the platform team.',
  );
  const judge = profile();
  await judge.onModuleInit();
  await judge.onModuleInit();
  const instructions = await readFile(
    path.join(APP_ROOT, 'judge-instructions.md'),
    'utf8',
  );
  expect(await judge.systemPrompt()).toBe(
    `${instructions}\nSam leads the platform team.`,
  );
  expect(instructions).toMatch(
    /change nothing: leave the\nnotification active and untouched/,
  );
});
