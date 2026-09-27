import { Logger } from '@nestjs/common';
import { CanvasService, SAVE_INTERVAL_MS } from './canvas.service.js';

const EMPTY = 'empty scene';

const DRAWN = 'drawn scene';

type Step = () => Promise<void>;

function fakes(latest?: string) {
  const calls: string[] = [];
  const step = (name: string) => async () => void calls.push(name);
  const server = {
    start: vi.fn<Step>(step('start server')),
    stop: vi.fn<Step>(step('stop server')),
    contents: vi.fn<() => Promise<string>>(async () => 'nothing drawn'),
  };
  const scene = {
    connect: vi.fn<Step>(step('connect')),
    close: vi.fn<Step>(step('close')),
    import: vi.fn<(scene: string) => Promise<void>>(step('import')),
    export: vi.fn<() => Promise<string>>(async () => EMPTY),
  };
  const history = {
    latest: vi.fn<() => Promise<string | undefined>>(async () => latest),
    save: vi.fn<(scene: string) => Promise<void>>(async () => undefined),
  };
  const canvas = new CanvasService(server, scene, history);
  return { calls, server, scene, history, canvas };
}

async function tick(): Promise<void> {
  await vi.advanceTimersByTimeAsync(SAVE_INTERVAL_MS);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('starts the canvas with the last saved version and stops it again', async () => {
  const { calls, scene, canvas } = fakes(DRAWN);
  await canvas.onModuleInit();
  expect(scene.import).toHaveBeenCalledExactlyOnceWith(DRAWN);
  await canvas.onApplicationShutdown();
  expect(calls).toEqual([
    'start server',
    'connect',
    'import',
    'close',
    'stop server',
  ]);
});

it('starts empty when the canvas was never saved', async () => {
  const { scene, canvas } = fakes();
  await canvas.onModuleInit();
  expect(scene.import).not.toHaveBeenCalled();
  await canvas.onApplicationShutdown();
});

it(`looks for changes every ${SAVE_INTERVAL_MS} ms and saves the ones it finds`, async () => {
  const { server, scene, history, canvas } = fakes(EMPTY);
  expect(SAVE_INTERVAL_MS).toBe(300);
  await canvas.onModuleInit();
  await vi.advanceTimersByTimeAsync(SAVE_INTERVAL_MS - 1);
  expect(server.contents).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(server.contents).toHaveBeenCalledOnce();
  expect(scene.export).toHaveBeenCalledOnce();
  expect(history.save).not.toHaveBeenCalled();
  await tick();
  expect(scene.export).toHaveBeenCalledOnce();
  server.contents.mockResolvedValue('holds a box');
  scene.export.mockResolvedValue(DRAWN);
  await tick();
  await tick();
  expect(scene.export).toHaveBeenCalledTimes(2);
  expect(history.save).toHaveBeenCalledExactlyOnceWith(DRAWN);
  await canvas.onApplicationShutdown();
  await tick();
  expect(server.contents).toHaveBeenCalledTimes(4);
});

it('saves a fresh canvas once', async () => {
  const { history, canvas } = fakes();
  await canvas.onModuleInit();
  await tick();
  await tick();
  expect(history.save).toHaveBeenCalledExactlyOnceWith(EMPTY);
  await canvas.onApplicationShutdown();
});

it('waits for one look before it starts the next', async () => {
  const { server, canvas } = fakes(EMPTY);
  const contents = Promise.withResolvers<string>();
  server.contents.mockReturnValueOnce(contents.promise);
  await canvas.onModuleInit();
  await tick();
  await tick();
  expect(server.contents).toHaveBeenCalledOnce();
  contents.resolve('nothing drawn');
  await tick();
  expect(server.contents).toHaveBeenCalledTimes(2);
  await canvas.onApplicationShutdown();
});

it('logs a failed save and tries again on the next look', async () => {
  const logError = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
  const { scene, history, canvas } = fakes(EMPTY);
  await canvas.onModuleInit();
  scene.export.mockResolvedValue(DRAWN);
  history.save.mockRejectedValueOnce(new Error('disk full'));
  await tick();
  expect(logError).toHaveBeenCalledExactlyOnceWith(
    'The canvas could not be saved: Error: disk full',
  );
  await tick();
  expect(history.save).toHaveBeenCalledTimes(2);
  await tick();
  expect(history.save).toHaveBeenCalledTimes(2);
  await canvas.onApplicationShutdown();
});

it('stops only what it started', async () => {
  const { calls, canvas } = fakes();
  await canvas.onApplicationShutdown();
  expect(calls).toEqual(['close', 'stop server']);
});
