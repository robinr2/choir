import { CanvasServer } from './canvas-server.js';
import { ExcalidrawScene } from './excalidraw-scene.js';
import { freeCanvasUrl } from '../test/free-canvas-url.js';

const canvasUrl = await freeCanvasUrl();

const config = {
  dataDir: '/data',
  coreUrl: 'http://localhost:3000',
  canvasUrl,
  canvasPublicUrl: canvasUrl,
};

const server = new CanvasServer(config);
const scene = new ExcalidrawScene(config);

beforeAll(async () => {
  await server.start();
  await scene.connect();
});

afterAll(async () => {
  await scene.close();
  await server.stop();
});

async function elements(): Promise<unknown[]> {
  const response = await fetch(`${config.canvasUrl}/api/elements`);
  return (await response.json()).elements;
}

it('exports the canvas as an .excalidraw scene', async () => {
  expect(JSON.parse(await scene.export())).toEqual({
    type: 'excalidraw',
    version: 2,
    source: 'mcp-excalidraw-server',
    elements: [],
    appState: { viewBackgroundColor: '#ffffff', gridSize: null },
  });
});

it('replaces the canvas with an imported scene', async () => {
  const rectangle = { id: 'box', type: 'rectangle', x: 1, y: 2 };
  await scene.import(JSON.stringify({ elements: [rectangle] }));
  await scene.import(
    JSON.stringify({ elements: [{ ...rectangle, id: 'other' }] }),
  );
  expect(await elements()).toEqual([
    expect.objectContaining({ id: 'other', type: 'rectangle', x: 1, y: 2 }),
  ]);
  expect(JSON.parse(await scene.export()).elements).toEqual([
    expect.objectContaining({ id: 'other', type: 'rectangle' }),
  ]);
});

it('clears the canvas for a scene without elements', async () => {
  await scene.import(
    JSON.stringify({
      elements: [{ id: 'box', type: 'rectangle', x: 0, y: 0 }],
    }),
  );
  await scene.import('{"elements":[]}');
  expect(await elements()).toEqual([]);
});

it('fails with the reason the canvas gives', async () => {
  await expect(
    scene.import(JSON.stringify({ elements: [{ id: 'box', type: 'blob' }] })),
  ).rejects.toThrow(
    'Error: Import failed: canvas rejected the batch create (elements were not restored)',
  );
});
