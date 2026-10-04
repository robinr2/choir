import { Injectable } from '@nestjs/common';
import type { SessionUpdate } from '@agentclientprotocol/sdk';
import { BehaviorSubject, type Observable } from 'rxjs';
import { z } from 'zod';

type RateLimitWindow = {
  window: string;
  utilization: number;
  resetsAt: number;
  status: string;
};

type RateLimits = { windows: RateLimitWindow[] };

const windowSchema = z.object({
  utilization: z.number(),
  resetsAt: z.number(),
  status: z.string().optional(),
});

const rateLimitSchema = z.object({
  status: z.string(),
  rateLimitType: z.string().optional(),
  utilization: z.number().optional(),
  resetsAt: z.number().optional(),
  unifiedWindows: z.record(z.string(), windowSchema).optional(),
});

const usageSchema = z
  .object({
    sessionUpdate: z.literal('usage_update'),
    _meta: z.object({ '_claude/rateLimit': rateLimitSchema }),
  })
  .transform(({ _meta: meta }) => meta['_claude/rateLimit']);

type RateLimit = z.infer<typeof rateLimitSchema>;

function singleWindow({
  status,
  rateLimitType,
  utilization,
  resetsAt,
}: RateLimit): RateLimitWindow[] {
  if (!rateLimitType || utilization === undefined || resetsAt === undefined) {
    return [];
  }
  return [{ window: rateLimitType, utilization, resetsAt, status }];
}

function rateLimitWindows(update: SessionUpdate): RateLimitWindow[] {
  const parsed = usageSchema.safeParse(update);
  if (!parsed.success) return [];
  const { unifiedWindows, status } = parsed.data;
  if (!unifiedWindows) return singleWindow(parsed.data);
  return Object.entries(unifiedWindows).map(([window, limit]) => ({
    window,
    utilization: limit.utilization,
    resetsAt: limit.resetsAt,
    status: limit.status ?? status,
  }));
}

@Injectable()
export class RateLimitsService {
  private readonly latest = new BehaviorSubject<RateLimits>({ windows: [] });

  get changes(): Observable<RateLimits> {
    return this.latest.asObservable();
  }

  get current(): RateLimits {
    return this.latest.value;
  }

  record(update: SessionUpdate): void {
    const seen = rateLimitWindows(update);
    if (seen.length === 0) return;
    const windows = new Map(
      [...this.current.windows, ...seen].map((limit) => [limit.window, limit]),
    );
    this.latest.next({ windows: [...windows.values()] });
  }
}
