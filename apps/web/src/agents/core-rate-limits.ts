import { type Feed, LiveStore } from '@/lib/live-store';

export type RateLimitWindow = {
  window: string;
  utilization: number;
  resetsAt: number;
  status: string;
};

export type RateLimits = { windows: RateLimitWindow[] };

export class CoreRateLimits extends LiveStore<RateLimits> {
  constructor(feed: Feed) {
    super(feed, { windows: [] });
  }

  protected receive(limits: RateLimits): void {
    this.update(limits);
  }
}
