import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { z } from 'zod';
import { CANVAS_PUBLIC_URL } from './create-app.js';
import { TestApp } from './test-app.js';

const sceneSchema = z.object({
  elements: z.array(z.object({ id: z.string() })),
});

function ids(scene: unknown): string[] {
  return sceneSchema.parse(scene).elements.map(({ id }) => id);
}

const testApp = TestApp.use();

function canvasFolder(): string {
  return path.join(testApp.dataDir, 'canvas');
}

async function draw(id: string): Promise<void> {
  const response = await fetch(`${testApp.canvasUrl}/api/elements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
    }),
  });
  expect(response.ok).toBe(true);
}

async function drawnIds(): Promise<string[]> {
  const response = await fetch(`${testApp.canvasUrl}/api/elements`);
  return ids(await response.json());
}

async function versions(): Promise<string[]> {
  return (await readdir(canvasFolder())).toSorted();
}

async function savedIds(): Promise<string[]> {
  const newest = (await versions()).at(-1) ?? '';
  const saved = await readFile(path.join(canvasFolder(), newest), 'utf8');
  return ids(JSON.parse(saved));
}

it('tells the browser the public address of the canvas', async () => {
  const response = await request(testApp.app.getHttpServer())
    .get('/canvas')
    .expect(200);
  expect(response.body).toEqual({ url: CANVAS_PUBLIC_URL });
});

it('saves the canvas as .excalidraw files and loads the last one after a restart', async () => {
  await draw('first-box');
  await vi.waitFor(async () => expect(await savedIds()).toEqual(['first-box']));
  const [newest] = (await versions()).slice(-1);
  expect(newest).toMatch(
    /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z\.excalidraw$/,
  );
  expect(
    JSON.parse(await readFile(path.join(canvasFolder(), newest ?? ''), 'utf8')),
  ).toMatchObject({ type: 'excalidraw', version: 2 });
  await testApp.reopen();
  expect(await drawnIds()).toEqual(['first-box']);
});

async function drawAndSave(box: number, last: number): Promise<void> {
  if (box > last) return;
  await draw(`box-${box}`);
  await vi.waitFor(async () =>
    expect((await savedIds()).at(-1)).toBe(`box-${box}`),
  );
  await drawAndSave(box + 1, last);
}

it('keeps the last ten versions of the canvas', async () => {
  await drawAndSave(1, 11);
  await vi.waitFor(async () => expect(await versions()).toHaveLength(10));
});
