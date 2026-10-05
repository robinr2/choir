import { LiveStore } from '@/lib/live-store';

export type RateLimitWindow = {
  window: string;
  utilization: number;
  resetsAt: number;
  status: string;
};

export type RateLimits = { windows: RateLimitWindow[] };

export class CoreRateLimits extends LiveStore<RateLimits> {
  constructor() {
    super('/rate-limits/events', { windows: [] });
  }

  protected receive(limits: RateLimits): void {
    this.update(limits);
  }
}
