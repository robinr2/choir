import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { filter, firstValueFrom, lastValueFrom, map, toArray } from 'rxjs';
import { mockAgentCommand } from '../test/mock-agent-command.js';
import { AgentSession } from './agent-session.js';
import type { AgentTurn } from './prompt-turn.js';

vi.setConfig({ testTimeout: 60_000 });

let dir: string;
let sessions: AgentSession[];

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'choir-session-'));
  sessions = [];
});

afterEach(async () => {
  await Promise.all(sessions.map((session) => session.close()));
  await rm(dir, { recursive: true, force: true });
});

async function opened(
  sessionId?: string,
  ...flags: string[]
): Promise<AgentSession> {
  const session = new AgentSession({
    command: mockAgentCommand(path.join(dir, 'sessions'), ...flags),
    cwd: dir,
    env: { CHOIR_CONVERSATION_ID: 'c1' },
  });
  sessions.push(session);
  expect(session.id).toBe('');
  await session.start({ cwd: dir, mcpServers: [], _meta: {} }, sessionId);
  return session;
}

function answer(turn: AgentTurn): Promise<string> {
  return lastValueFrom(
    turn.updates.pipe(
      filter((update) => update.sessionUpdate === 'agent_message_chunk'),
      map((update) => ('text' in update.content ? update.content.text : '')),
      toArray(),
      map((texts) => texts.join('')),
    ),
  );
}

it('runs the turns of a session one after another', async () => {
  const session = await opened();
  const order: string[] = [];
  const first = session.startTurn('stream-sleep 300 first');
  const second = session.startTurn('echo second');
  void first.result.then(() => order.push('first'));
  void second.result.then(() => order.push('second'));
  expect(await answer(first)).toBe('first');
  expect(await answer(second)).toBe('second');
  expect(await second.result).toEqual({ stopReason: 'end_turn' });
  expect(order).toEqual(['first', 'second']);
  expect(await answer(session.startTurn('env CHOIR_CONVERSATION_ID'))).toBe(
    'c1',
  );
});

it('loads a saved session with its history', async () => {
  const first = await opened();
  await first.startTurn('echo hi').result;
  await first.close();
  const loaded = await opened(first.id);
  expect(loaded.id).toBe(first.id);
  expect(loaded.history).toEqual([
    {
      sessionUpdate: 'user_message_chunk',
      content: { type: 'text', text: 'echo hi' },
    },
    {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'hi' },
    },
  ]);
  expect(await answer(loaded.startTurn('echo again'))).toBe('again');
});

it('cancels a running turn and withdraws a queued one', async () => {
  const session = await opened();
  const running = session.startTurn('stream-sleep 20000 long');
  const queued = session.startTurn('echo never');
  await firstValueFrom(running.updates);
  await queued.cancel();
  await running.cancel();
  expect(await running.result).toEqual({ stopReason: 'cancelled' });
  expect(await queued.result).toBeUndefined();
  expect(await answer(session.startTurn('echo next'))).toBe('next');
});

it('allows what the agent asks with the first option that allows it', async () => {
  const session = await opened();
  expect(
    await answer(session.startTurn('ask-permission reject_once allow_always')),
  ).toBe('{"outcome":"selected","optionId":"allow_always-option"}');
  expect(await answer(session.startTurn('ask-permission reject_once'))).toBe(
    '{"outcome":"cancelled"}',
  );
});

it('fails a turn whose prompt fails', async () => {
  const session = await opened();
  const turn = session.startTurn('fail');
  await expect(turn.result).rejects.toThrow('Internal error');
  await expect(lastValueFrom(turn.updates)).rejects.toThrow('Internal error');
});

it('refuses to load a session the agent cannot load', async () => {
  await expect(opened('s1', '--no-load-session')).rejects.toThrow(
    'The agent cannot load the session s1',
  );
});

it('fails to start when the agent refuses the permission mode', async () => {
  await expect(opened(undefined, '--set-session-mode-fails')).rejects.toThrow(
    'Internal error',
  );
});
