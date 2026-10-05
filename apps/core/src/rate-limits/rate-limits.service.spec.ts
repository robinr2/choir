import type { SessionUpdate } from '@agentclientprotocol/sdk';
import { firstValueFrom, take, toArray } from 'rxjs';
import { RateLimitsService } from './rate-limits.service.js';

function usage(rateLimit?: object): SessionUpdate {
  return {
    sessionUpdate: 'usage_update',
    used: 1,
    size: 2,
    ...(rateLimit && { _meta: { '_claude/rateLimit': rateLimit } }),
  };
}

const FIVE_HOURS = {
  status: 'allowed',
  rateLimitType: 'five_hour',
  utilization: 0.2,
  resetsAt: 100,
};

it('keeps the latest window of every rate limit it hears of', async () => {
  const rateLimits = new RateLimitsService();
  const seen = firstValueFrom(rateLimits.changes.pipe(take(3), toArray()));
  rateLimits.record(usage(FIVE_HOURS));
  rateLimits.record(
    usage({
      ...FIVE_HOURS,
      status: 'allowed_warning',
      unifiedWindows: {
        seven_day: { utilization: 0.5, resetsAt: 300 },
        five_hour: { utilization: 0.3, resetsAt: 200, status: 'rejected' },
      },
    }),
  );
  expect(await seen).toEqual([
    { windows: [] },
    {
      windows: [
        {
          window: 'five_hour',
          utilization: 0.2,
          resetsAt: 100,
          status: 'allowed',
        },
      ],
    },
    {
      windows: [
        {
          window: 'five_hour',
          utilization: 0.3,
          resetsAt: 200,
          status: 'rejected',
        },
        {
          window: 'seven_day',
          utilization: 0.5,
          resetsAt: 300,
          status: 'allowed_warning',
        },
      ],
    },
  ]);
  expect(rateLimits.current.windows).toHaveLength(2);
});

it('ignores updates without a complete rate limit', () => {
  const rateLimits = new RateLimitsService();
  const seen: unknown[] = [];
  rateLimits.changes.subscribe((limits) => seen.push(limits));
  rateLimits.record(usage());
  rateLimits.record(usage({ ...FIVE_HOURS, rateLimitType: undefined }));
  rateLimits.record(usage({ ...FIVE_HOURS, utilization: undefined }));
  rateLimits.record(usage({ ...FIVE_HOURS, resetsAt: undefined }));
  rateLimits.record(usage({ ...FIVE_HOURS, rateLimitType: '' }));
  rateLimits.record({ sessionUpdate: 'plan', entries: [] });
  expect(rateLimits.current).toEqual({ windows: [] });
  expect(seen).toHaveLength(1);
});
