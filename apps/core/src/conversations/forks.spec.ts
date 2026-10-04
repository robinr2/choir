import { of, toArray, firstValueFrom } from 'rxjs';
import type { ConversationState } from './conversation-state.js';
import { forkChanges, forkOf } from './forks.js';

const SEED = { id: 'f1', sessionId: 's2', prompt: 'write tests', startedAt: 1 };

function state(
  status: ConversationState['status']['state'],
  title: string | null = null,
): ConversationState {
  return {
    messages: [],
    session: { id: 's2', cwd: '/w', title },
    status: { state: status, since: 9 },
    queue: [],
    settings: null,
    usage: null,
    commands: [],
    plan: [],
    forks: [],
  };
}

it('lists a fork as running until its conversation is idle or failed', () => {
  expect(forkOf(SEED, state('starting'))).toEqual({
    id: 'f1',
    sessionId: 's2',
    title: 'write tests',
    state: 'running',
    startedAt: 1,
    endedAt: null,
  });
  expect(forkOf(SEED, state('working')).state).toBe('running');
  expect(forkOf(SEED, state('waiting')).state).toBe('running');
  expect(forkOf(SEED, state('idle'))).toMatchObject({
    state: 'ready',
    endedAt: 9,
  });
  expect(forkOf(SEED, state('failed'))).toMatchObject({
    state: 'failed',
    endedAt: 9,
  });
});

it('names a fork after its session, its prompt or else just a fork', () => {
  expect(forkOf(SEED, state('idle', 'Tests')).title).toBe('Tests');
  expect(forkOf({ ...SEED, prompt: '' }, state('idle')).title).toBe('Fork');
  expect(forkOf(SEED, { ...state('idle'), session: null }).title).toBe(
    'write tests',
  );
});

it('follows the states of a fork', async () => {
  const forks = forkChanges(SEED, of(state('working'), state('idle')));
  expect(
    (await firstValueFrom(forks.pipe(toArray()))).map((fork) => fork.state),
  ).toEqual(['running', 'ready']);
});
