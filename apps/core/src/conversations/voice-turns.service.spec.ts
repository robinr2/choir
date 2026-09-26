import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VoiceTurnsService } from './voice-turns.service.js';

let dataDir: string;
let voiceTurns: VoiceTurnsService;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-voice-'));
  voiceTurns = new VoiceTurnsService({
    dataDir: path.join(dataDir, 'not', 'made'),
    coreUrl: 'http://localhost:3000',
  });
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('remembers the spoken prompts of each conversation', async () => {
  expect(await voiceTurns.load('c1')).toEqual(new Set());
  await voiceTurns.save('c1', new Set(['hello', 'go on']));
  expect(await voiceTurns.load('c1')).toEqual(new Set(['hello', 'go on']));
  expect(await voiceTurns.load('c2')).toEqual(new Set());
});

it('fails when the saved prompts cannot be read', async () => {
  await mkdir(path.join(dataDir, 'not', 'made', 'voice-turns', 'c1.json'), {
    recursive: true,
  });
  await expect(voiceTurns.load('c1')).rejects.toThrow(/EISDIR/);
});
