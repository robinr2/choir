import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TurnMarksService } from './turn-marks.service.js';

let dataDir: string;
let turnMarks: TurnMarksService;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-marks-'));
  turnMarks = new TurnMarksService({ dataDir, coreUrl: 'http://core' });
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('knows no marks of a conversation it never saved', async () => {
  expect(await turnMarks.load('c1')).toEqual(new Map());
});

it('keeps the marks of every turn of a conversation', async () => {
  const marks = new Map([
    ['spoken', { voice: true as const, aloud: true as const }],
    ['framed', { from: { id: 'a2', name: 'helper' }, text: 'hi' }],
  ]);
  await turnMarks.save('c1', new Map());
  await turnMarks.save('c1', marks);
  expect(await turnMarks.load('c1')).toEqual(marks);
  expect(await turnMarks.load('c2')).toEqual(new Map());
});

it('fails when the marks cannot be read', async () => {
  await mkdir(path.join(dataDir, 'turn-marks', 'c1.json'), { recursive: true });
  await expect(turnMarks.load('c1')).rejects.toThrow(/EISDIR/);
});
