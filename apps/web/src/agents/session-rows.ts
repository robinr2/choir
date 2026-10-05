import type { ThreadItem } from '@/components/assistant-ui/elements/thread-list';
import type { AgentSession } from './core-agents';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

const UNITS = [
  { size: MINUTE, name: 'minute', below: HOUR },
  { size: HOUR, name: 'hour', below: DAY },
  { size: DAY, name: 'day', below: 7 * DAY },
] as const;

export function lastChange(iso: string | null, now: number): string {
  if (iso === null) return '';
  const time = Date.parse(iso);
  const ago = Math.max(0, now - time);
  if (ago < MINUTE) return 'just now';
  const unit = UNITS.find(({ below }) => ago < below);
  if (!unit) return DATE.format(time);
  return RELATIVE.format(-Math.floor(ago / unit.size), unit.name);
}

export function sessionRows(
  sessions: readonly AgentSession[],
  now: number,
): ThreadItem[] {
  return sessions.map(({ sessionId, cwd, title, updatedAt }) => ({
    id: sessionId,
    title: title ?? 'Untitled session',
    folder: cwd,
    time: lastChange(updatedAt, now),
  }));
}
