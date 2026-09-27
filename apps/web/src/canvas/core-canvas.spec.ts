import { afterEach, expect, test, vi } from 'vitest';
import { requests } from '@/test/fake-event-source';
import { CoreCanvas } from './core-canvas';

afterEach(() => {
  vi.restoreAllMocks();
});

test('asks core once where the canvas is served', async () => {
  vi.spyOn(window, 'fetch').mockImplementation(async () =>
    Response.json({ url: 'http://127.0.0.1:3100' }),
  );
  const canvas = new CoreCanvas();
  expect(await canvas.url()).toBe('http://127.0.0.1:3100');
  expect(await canvas.url()).toBe('http://127.0.0.1:3100');
  expect(requests()).toEqual([['/canvas', 'GET', undefined]]);
});
