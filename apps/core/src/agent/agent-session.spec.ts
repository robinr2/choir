import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  filter,
  firstValueFrom,
  lastValueFrom,
  map,
  type Observable,
  take,
  toArray,
} from 'rxjs';
import { mockAgentCommand } from '../test/mock-agent-command.js';
import { AgentSession, type SessionStart } from './agent-session.js';
import type { InteractionEvent } from './interactions.js';
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

function created(...flags: string[]): AgentSession {
  const session = new AgentSession({
    command: mockAgentCommand(path.join(dir, 'sessions'), ...flags),
    cwd: dir,
    env: { CHOIR_CONVERSATION_ID: 'c1' },
  });
  sessions.push(session);
  return session;
}

async function opened(
  start?: SessionStart,
  ...flags: string[]
): Promise<AgentSession> {
  const session = created(...flags);
  expect(session.id).toBe('');
  expect(session.cwd).toBe('');
  await session.start({ cwd: dir, mcpServers: [], _meta: {} }, start);
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

function streaming(turn: AgentTurn): Promise<unknown> {
  return firstValueFrom(
    turn.updates.pipe(
      filter((update) => update.sessionUpdate === 'agent_message_chunk'),
    ),
  );
}

function say(session: AgentSession, text: string): Promise<string> {
  return answer(session.startTurn({ text }));
}

function requested(
  events: Observable<InteractionEvent>,
): Promise<Extract<InteractionEvent, { type: 'requested' }>> {
  return firstValueFrom(
    events.pipe(
      filter(
        (event): event is Extract<InteractionEvent, { type: 'requested' }> =>
          event.type === 'requested',
      ),
    ),
  );
}

it('sends a turn at once and hands the updates to the latest turn', async () => {
  const session = await opened();
  expect(session.cwd).toBe(dir);
  const first = session.startTurn({ text: 'stream-sleep 1000 first' });
  await streaming(first);
  const second = session.startTurn({ text: 'echo second' });
  expect(await answer(second)).toBe('second');
  expect(await answer(first)).toBe('first');
  expect(await first.result).toEqual({ stopReason: 'end_turn' });
  expect(await say(session, 'env CHOIR_CONVERSATION_ID')).toBe('c1');
});

it('tells the agent what choir can show and sends images with the text', async () => {
  const session = await opened();
  expect(JSON.parse(await say(session, 'capabilities'))).toEqual({
    session: { notices: {}, compaction: {}, configOptions: { boolean: {} } },
    subagents: {},
    elicitation: { form: {}, url: {} },
    auth: { terminal: false },
    fs: { readTextFile: false, writeTextFile: false },
    terminal: false,
  });
  const images = [{ data: 'aGk=', mimeType: 'image/png' }];
  const turn = session.startTurn({ text: 'prompt-blocks', images });
  expect(JSON.parse(await answer(turn))).toEqual([
    { type: 'text', text: 'prompt-blocks' },
    { type: 'image', data: 'aGk=', mimeType: 'image/png' },
  ]);
});

function chunk(sessionId: string, text: string) {
  return {
    sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text },
    },
  };
}

it('replays every update of the session to each subscriber before the live ones', async () => {
  const session = await opened();
  await say(session, 'echo hi');
  const seen = firstValueFrom(session.updates.pipe(take(3), toArray()));
  await say(session, 'echo again');
  expect(await seen).toEqual([
    {
      sessionId: session.id,
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: [
          { name: 'compact', description: 'Compact' },
          { name: 'review', description: 'Review', input: { hint: 'pr' } },
        ],
      },
    },
    chunk(session.id, 'hi'),
    chunk(session.id, 'again'),
  ]);
  expect(session.history).toHaveLength(3);
});

it('loads a saved session with its history', async () => {
  const first = await opened();
  await say(first, 'echo hi');
  await first.close();
  const loaded = await opened({ sessionId: first.id });
  expect(loaded.id).toBe(first.id);
  expect(loaded.history.slice(0, 2)).toEqual([
    {
      sessionId: first.id,
      update: {
        sessionUpdate: 'user_message_chunk',
        content: { type: 'text', text: 'echo hi' },
      },
    },
    chunk(first.id, 'hi'),
  ]);
  expect(await say(loaded, 'echo again')).toBe('again');
  expect(await say(loaded, 'mode')).toBe('bypassPermissions');
});

it('starts a new session in the mode it is given, or else in bypass permissions mode', async () => {
  expect(await say(await opened(), 'mode')).toBe('bypassPermissions');
  expect(await say(await opened({ mode: 'plan' }), 'mode')).toBe('plan');
});

it('follows the config options of the session', async () => {
  const session = await opened({ mode: 'plan' });
  const values = () =>
    firstValueFrom(
      session.configOptions.pipe(
        map((options) =>
          Object.fromEntries(options.map((o) => [o.id, o.currentValue])),
        ),
      ),
    );
  expect(await values()).toEqual({
    mode: 'plan',
    model: 'default',
    effort: 'default',
    fast: false,
  });
  const changes = firstValueFrom(
    session.configOptions.pipe(take(3), toArray()),
  );
  await session.setConfigOption('model', 'haiku');
  await session.setConfigOption('fast', true);
  expect((await changes).map((options) => options.length)).toEqual([4, 3, 3]);
  expect(await values()).toEqual({ mode: 'plan', model: 'haiku', fast: true });
  await say(session, 'push-config');
  expect(await values()).toEqual({
    mode: 'default',
    model: 'opus',
    effort: 'default',
    fast: true,
  });
});

it('starts and loads sessions of an agent without config options', async () => {
  const flag = '--no-config-options';
  const started = await opened(undefined, flag);
  expect(await firstValueFrom(started.configOptions)).toEqual([]);
  await say(started, 'echo hi');
  await started.close();
  const loaded = await opened({ sessionId: started.id }, flag);
  expect(await firstValueFrom(loaded.configOptions)).toEqual([]);
});

it('cancels a running turn', async () => {
  const session = await opened();
  const running = session.startTurn({ text: 'stream-sleep 20000 long' });
  await streaming(running);
  await running.cancel();
  expect(await running.result).toEqual({ stopReason: 'cancelled' });
  expect(await say(session, 'echo next')).toBe('next');
});

it('steers a running turn and tells when none runs', async () => {
  const session = await opened();
  const running = session.startTurn({ text: 'stream-sleep 1000 working' });
  await streaming(running);
  expect(await session.steer({ text: 'use pnpm' })).toBe(true);
  expect(await answer(running)).toBe('workingsteered: use pnpm');
  expect(await session.steer({ text: 'echo idle' })).toBe(false);
});

it('asks the user what the agent asks and answers with what the user chose', async () => {
  const session = await opened();
  const asked = requested(session.interactions);
  const turn = session.startTurn({
    text: 'ask-permission reject_once allow_always',
  });
  const { interaction } = await asked;
  expect(interaction).toMatchObject({
    kind: 'permission',
    request: { sessionId: session.id, options: expect.any(Array) },
  });
  expect(session.respond('unknown', { optionId: 'x' })).toBe('unknown');
  expect(
    session.respond(interaction.id, { optionId: 'allow_once-option' }),
  ).toBe('unfit');
  expect(session.respond(interaction.id, { action: 'decline' })).toBe('unfit');
  const settled = firstValueFrom(
    session.interactions.pipe(filter(({ type }) => type === 'settled')),
  );
  expect(
    session.respond(interaction.id, { optionId: 'allow_always-option' }),
  ).toBe('answered');
  expect(session.respond(interaction.id, { action: 'cancel' })).toBe('unknown');
  expect(await answer(turn)).toBe(
    '{"outcome":"selected","optionId":"allow_always-option"}',
  );
  expect(await settled).toEqual({
    type: 'settled',
    id: interaction.id,
    answer: { optionId: 'allow_always-option' },
  });
});

it('cancels what the agent asks when the user cancels it, the turn or the agent', async () => {
  const session = await opened();
  const asked = requested(session.interactions);
  const dismissed = session.startTurn({ text: 'ask-permission allow_once' });
  session.respond((await asked).interaction.id, { action: 'cancel' });
  expect(await answer(dismissed)).toBe('{"outcome":"cancelled"}');
  const again = requested(session.interactions);
  const cancelled = session.startTurn({ text: 'ask-permission allow_once' });
  await again;
  await cancelled.cancel();
  expect(await cancelled.result).toEqual({ stopReason: 'end_turn' });
  const withdrawn = firstValueFrom(
    session.interactions.pipe(filter(({ type }) => type === 'settled')),
  );
  const turn = session.startTurn({
    text: 'ask-permission allow_once withdraw',
  });
  expect(await withdrawn).toMatchObject({ answer: { action: 'cancel' } });
  expect(await answer(turn)).toBe('{"outcome":"cancelled"}');
});

it('asks the user to fill in forms and to open links for the agent', async () => {
  const session = await opened();
  const events = firstValueFrom(session.interactions.pipe(take(5), toArray()));
  const form = session.startTurn({ text: 'elicit form' });
  const { interaction } = await requested(session.interactions);
  expect(session.respond(interaction.id, { optionId: 'x' })).toBe('unfit');
  expect(
    session.respond(interaction.id, { action: 'accept', content: { a: 'b' } }),
  ).toBe('answered');
  expect(await answer(form)).toBe('{"action":"accept","content":{"a":"b"}}');
  const link = session.startTurn({ text: 'elicit url' });
  const asked = await requested(session.interactions);
  expect(asked.interaction).toMatchObject({
    kind: 'elicitation',
    request: { mode: 'url', url: 'https://example.com' },
  });
  session.respond(asked.interaction.id, { action: 'decline' });
  expect(await answer(link)).toBe('{"action":"decline"}');
  expect((await events).map(({ type }) => type)).toEqual([
    'requested',
    'settled',
    'requested',
    'settled',
    'completed',
  ]);
});

it('follows the subagents of the session and ignores other sessions', async () => {
  const session = await opened();
  await say(session, 'echo start');
  const seen = firstValueFrom(
    session.updates.pipe(
      filter(
        ({ update }) => update.sessionUpdate !== 'available_commands_update',
      ),
      take(5),
      toArray(),
    ),
  );
  const turn = session.startTurn({ text: 'subagent explore' });
  expect(await answer(turn)).toBe('explore reported');
  const [, spawned, child, state, reported] = await seen;
  const subagentSessionId = child.sessionId;
  expect(subagentSessionId).not.toBe(session.id);
  expect(child).toEqual(chunk(subagentSessionId, 'explore done'));
  expect(spawned).toEqual({
    sessionId: session.id,
    update: {
      sessionUpdate: 'subagent_spawned',
      subagentSessionId,
      name: 'explore',
      task: 'Do explore',
    },
  });
  expect(state).toEqual({
    sessionId: session.id,
    update: {
      sessionUpdate: 'subagent_state_update',
      subagentSessionId,
      state: 'completed',
    },
  });
  expect(reported).toEqual(chunk(session.id, 'explore reported'));
});

it('fails a turn whose prompt fails', async () => {
  const session = await opened();
  const turn = session.startTurn({ text: 'fail' });
  await expect(turn.result).rejects.toThrow('Internal error');
  await expect(lastValueFrom(turn.updates)).rejects.toThrow('Internal error');
});

it('refuses to load a session the agent cannot load', async () => {
  await expect(
    opened({ sessionId: 's1' }, '--no-load-session'),
  ).rejects.toThrow('The agent cannot load the session s1');
});

it('fails to start when the agent refuses the permission mode', async () => {
  await expect(opened(undefined, '--set-config-fails')).rejects.toThrow(
    'Internal error',
  );
});
