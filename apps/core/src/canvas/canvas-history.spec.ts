import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CanvasHistory, KEPT_VERSIONS } from './canvas-history.js';

let dataDir: string;
let history: CanvasHistory;

function canvasFolder(): string {
  return path.join(dataDir, 'canvas');
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-canvas-'));
  history = new CanvasHistory({
    dataDir,
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  });
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(dataDir, { recursive: true, force: true });
});

it('has no versions before the canvas was saved', async () => {
  expect(await history.versions()).toEqual([]);
  expect(await history.latest()).toBeUndefined();
});

it('saves each version as an .excalidraw file named by its time', async () => {
  vi.useFakeTimers({ now: new Date('2026-09-27T10:00:00.000Z') });
  await history.save('{"first":true}');
  vi.setSystemTime(new Date('2026-09-27T10:00:00.300Z'));
  await history.save('{"second":true}');
  expect(await readdir(canvasFolder())).toEqual([
    '2026-09-27T10-00-00.000Z.excalidraw',
    '2026-09-27T10-00-00.300Z.excalidraw',
  ]);
  expect(await history.latest()).toBe('{"second":true}');
});

async function saveVersions(version: number, last: number): Promise<void> {
  if (version > last) return;
  vi.setSystemTime(new Date(Date.UTC(2026, 8, 27, 10, version)));
  await history.save(`{"version":${version}}`);
  await saveVersions(version + 1, last);
}

it(`keeps only the last ${KEPT_VERSIONS} versions`, async () => {
  vi.useFakeTimers();
  await saveVersions(1, KEPT_VERSIONS + 2);
  const versions = await history.versions();
  expect(KEPT_VERSIONS).toBe(10);
  expect(versions).toHaveLength(10);
  expect(versions[0]).toBe('2026-09-27T10-03-00.000Z.excalidraw');
  expect(await history.latest()).toBe('{"version":12}');
});

it('leaves other files in the canvas folder alone', async () => {
  await mkdir(canvasFolder());
  await writeFile(path.join(canvasFolder(), 'notes.txt'), 'mine');
  await history.save('{}');
  expect(await history.versions()).toHaveLength(1);
  expect(await readdir(canvasFolder())).toContain('notes.txt');
});

it('fails when the canvas folder cannot be read', async () => {
  await writeFile(canvasFolder(), 'not a folder');
  await expect(history.versions()).rejects.toThrow(/EEXIST/);
});
