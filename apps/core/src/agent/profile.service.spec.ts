import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProfileService } from './profile.service.js';

const APP_ROOT = path.resolve(import.meta.dirname, '..', '..');

let dataDir: string;

function profileFile(...parts: string[]): string {
  return path.join(dataDir, 'profiles', 'default', ...parts);
}

async function prepare(): Promise<void> {
  await new ProfileService({
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
  }).onModuleInit();
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-profile-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('sets up the default profile as a plugin with the voice prompt', async () => {
  await prepare();
  expect(
    JSON.parse(
      await readFile(profileFile('.claude-plugin', 'plugin.json'), 'utf8'),
    ),
  ).toEqual({
    name: 'choir-profile',
  });
  expect(await readFile(profileFile('hooks', 'hooks.json'), 'utf8')).toBe(
    await readFile(
      path.join(APP_ROOT, 'profile-template', 'hooks', 'hooks.json'),
      'utf8',
    ),
  );
  expect(await readFile(profileFile('default-voice-prompt.md'), 'utf8')).toBe(
    await readFile(path.join(APP_ROOT, 'default-voice-prompt.md'), 'utf8'),
  );
  expect((await stat(path.join(dataDir, 'default'))).isDirectory()).toBe(true);
});

it('keeps a profile the user has changed', async () => {
  await mkdir(profileFile('hooks'), { recursive: true });
  await writeFile(profileFile('default-voice-prompt.md'), 'my prompt');
  await writeFile(profileFile('hooks', 'hooks.json'), '{}');
  await prepare();
  await prepare();
  expect(await readFile(profileFile('default-voice-prompt.md'), 'utf8')).toBe(
    'my prompt',
  );
  expect(await readFile(profileFile('hooks', 'hooks.json'), 'utf8')).toBe('{}');
});

it('fails when the profile cannot be written', async () => {
  await writeFile(path.join(dataDir, 'profiles'), '');
  await expect(prepare()).rejects.toThrow(/ENOTDIR|EEXIST/);
});

it('fails when the prompt cannot be copied into the profile', async () => {
  await prepare();
  await rm(profileFile('default-voice-prompt.md'));
  await chmod(profileFile(), 0o555);
  await expect(prepare()).rejects.toThrow(/EACCES/);
  await chmod(profileFile(), 0o755);
});
