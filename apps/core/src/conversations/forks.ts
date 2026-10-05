import { map, type Observable } from 'rxjs';
import type { ConversationState, Fork } from './conversation-state.js';

type Seed = {
  id: string;
  sessionId: string;
  prompt: string;
  startedAt: number;
};

const STATES: Record<ConversationState['status']['state'], Fork['state']> = {
  starting: 'running',
  working: 'running',
  waiting: 'running',
  idle: 'ready',
  failed: 'failed',
};

export function forkOf(
  { id, sessionId, prompt, startedAt }: Seed,
  { session, status }: ConversationState,
): Fork {
  const state = STATES[status.state];
  return {
    id,
    sessionId,
    title: session?.title ?? (prompt || 'Fork'),
    state,
    startedAt,
    endedAt: state === 'running' ? null : status.since,
  };
}

export function forkChanges(
  seed: Seed,
  states: Observable<ConversationState>,
): Observable<Fork> {
  return states.pipe(map((state) => forkOf(seed, state)));
}
