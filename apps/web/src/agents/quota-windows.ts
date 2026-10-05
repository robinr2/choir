import type { QuotaWindow } from '@/components/assistant-ui/elements/quota-banner';
import type { RateLimitWindow } from './core-rate-limits';

const LABELS: Record<string, string> = {
  five_hour: '5-hour',
  seven_day: 'Weekly',
};

const DAY = 24 * 60 * 60 * 1000;

const TIME = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

const DAY_AND_TIME = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export function resetTime(resetsAt: number, now: number): string {
  const time = resetsAt * 1000;
  return (time - now < DAY ? TIME : DAY_AND_TIME).format(time);
}

export function quotaWindows(
  windows: readonly RateLimitWindow[],
  now: number,
): QuotaWindow[] {
  return Object.entries(LABELS).flatMap(([key, label]) => {
    const found = windows.find(({ window }) => window === key);
    if (!found) return [];
    return [
      {
        label,
        percent: Math.round(found.utilization * 100),
        resets: resetTime(found.resetsAt, now),
      },
    ];
  });
}
