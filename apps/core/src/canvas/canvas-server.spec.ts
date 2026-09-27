import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { CanvasServer } from './canvas-server.js';
import { canvasServerPath } from './excalidraw.js';

const CANVAS_URL = 'http://127.0.0.1:3197';

const config = {
  dataDir: '/data',
  coreUrl: 'http://localhost:3000',
  canvasUrl: CANVAS_URL,
  canvasPublicUrl: CANVAS_URL,
};

async function health(): Promise<unknown> {
  const response = await fetch(`${CANVAS_URL}/health`);
  return response.json();
}

async function answers(): Promise<boolean> {
  return health().then(
    () => true,
    () => false,
  );
}

it('starts the Excalidraw canvas server and stops it again', async () => {
  const server = new CanvasServer(config);
  await server.start();
  expect(await health()).toMatchObject({
    status: 'healthy',
    service: 'mcp-excalidraw-canvas',
  });
  await server.stop();
  expect(await answers()).toBe(false);
  await server.stop();
});

it('reads what the canvas holds, so a change shows before an export', async () => {
  const server = new CanvasServer(config);
  await server.start();
  const empty = await server.contents();
  expect(empty).toBe(
    `${JSON.stringify({ success: true, elements: [], count: 0 })}\n${JSON.stringify({ files: {} })}`,
  );
  expect(await server.contents()).toBe(empty);
  await fetch(`${CANVAS_URL}/api/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ id: 'f', dataURL: 'data:image/png;base64,AA' }]),
  });
  expect(await server.contents()).toContain('"files":{"f":');
  await server.stop();
});

it('has nothing to stop before it started', async () => {
  await expect(new CanvasServer(config).stop()).resolves.toBeUndefined();
});

it('fails when another canvas server holds its port', async () => {
  const other = spawn(process.execPath, [canvasServerPath()], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '3197' },
    stdio: 'ignore',
  });
  try {
    await vi.waitFor(async () => expect(await answers()).toBe(true), {
      timeout: 10_000,
    });
    await expect(new CanvasServer(config).start()).rejects.toThrow(
      `The Excalidraw canvas server for ${CANVAS_URL} exited with code 1 before it answered`,
    );
    const polls = vi.spyOn(globalThis, 'fetch');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(polls).not.toHaveBeenCalled();
  } finally {
    other.kill();
    await once(other, 'exit');
  }
});
