import type { AgentState } from '@/components/assistant-ui/elements/agent-status';
import type { StatusState } from '@/conversation/core-conversation';

type Shown = { state: AgentState; label: string; ticks: boolean };

const SHOWN: Record<StatusState, Shown> = {
  starting: { state: 'working', label: 'Starting', ticks: false },
  working: { state: 'working', label: 'Working', ticks: true },
  waiting: { state: 'waiting', label: 'Waiting for you', ticks: true },
  idle: { state: 'done', label: 'Done', ticks: false },
  failed: { state: 'failed', label: 'Failed', ticks: false },
};

export function shownStatus(state: StatusState): Shown {
  return SHOWN[state];
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function elapsed(since: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const minutes = Math.floor(seconds / 60);
  const clock = `${twoDigits(minutes % 60)}:${twoDigits(seconds % 60)}`;
  if (minutes < 60) return `${minutes}:${twoDigits(seconds % 60)}`;
  return `${Math.floor(minutes / 60)}:${clock}`;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
