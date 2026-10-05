import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fakeCore } from '@/test/fake-core';
import { FakeEventSource } from '@/test/fake-event-source';
import { CoreRateLimits } from './core-rate-limits';

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('follows the account rate limits', () => {
  const rateLimits = new CoreRateLimits();
  const listener = vi.fn<() => void>();
  expect(rateLimits.getSnapshot()).toEqual({ windows: [] });
  rateLimits.subscribe(listener);
  const [source] = FakeEventSource.opened;
  expect(source?.url).toBe('/rate-limits/events');
  const limits = {
    windows: [
      { window: 'five_hour', utilization: 0.5, resetsAt: 1, status: 'allowed' },
    ],
  };
  source?.receive(limits);
  expect(rateLimits.getSnapshot()).toEqual(limits);
  expect(listener).toHaveBeenCalledOnce();
});
