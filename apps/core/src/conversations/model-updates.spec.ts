import { newModel } from './conversation-model.js';
import { holds, sessionUpdateOf, withReceived } from './model-updates.js';
import { toolCallPart } from './tool-call-part.js';

const ROOT = 'root';

const SPAWNED = {
  sessionUpdate: 'subagent_spawned',
  subagentSessionId: 'a',
  name: 'helper',
  task: 'Help',
} as const;

const PAID = {
  sessionUpdate: 'usage_update',
  used: 1,
  size: 2,
  cost: { amount: 1, currency: 'USD' },
} as const;

it('adds what the root session says to the transcript and its details', () => {
  const titled = withReceived(
    newModel(1),
    ROOT,
    {
      sessionId: ROOT,
      update: { sessionUpdate: 'session_info_update', title: 'Notes' },
    },
    5,
  );
  expect(titled.details.title).toBe('Notes');
  const spawned = withReceived(
    titled,
    ROOT,
    { sessionId: ROOT, update: SPAWNED },
    5,
  );
  expect(spawned.messages[0]?.parts[0]).toMatchObject({ toolCallId: 'a' });
  const nested = withReceived(
    spawned,
    ROOT,
    {
      sessionId: 'a',
      update: { sessionUpdate: 'session_info_update', title: 'Sub' },
    },
    5,
  );
  expect(nested.details.title).toBe('Notes');
});

it('passes on session updates and not subagent ones', () => {
  expect(sessionUpdateOf({ sessionId: ROOT, update: PAID })).toBe(PAID);
  expect(sessionUpdateOf({ sessionId: ROOT, update: SPAWNED })).toBeUndefined();
});

it('knows when the turn only waits for its background subagents', () => {
  const running = withReceived(
    newModel(1),
    ROOT,
    { sessionId: ROOT, update: SPAWNED },
    5,
  );
  expect(holds(running, ROOT, { sessionId: ROOT, update: PAID })).toBe(true);
  expect(holds(running, ROOT, { sessionId: 'a', update: PAID })).toBe(false);
  expect(
    holds(running, ROOT, { sessionId: ROOT, update: { ...PAID, cost: null } }),
  ).toBe(false);
  expect(holds(running, ROOT, { sessionId: ROOT, update: SPAWNED })).toBe(
    false,
  );
  expect(holds(newModel(1), ROOT, { sessionId: ROOT, update: PAID })).toBe(
    false,
  );
  const done = withReceived(
    running,
    ROOT,
    {
      sessionId: ROOT,
      update: {
        sessionUpdate: 'subagent_state_update',
        subagentSessionId: 'a',
        state: 'completed',
      },
    },
    6,
  );
  expect(holds(done, ROOT, { sessionId: ROOT, update: PAID })).toBe(false);
  const tool = {
    ...newModel(1),
    messages: [
      {
        id: 'm0',
        role: 'assistant' as const,
        parts: [{ ...toolCallPart('t1', 1), status: 'in_progress' as const }],
      },
    ],
  };
  expect(holds(tool, ROOT, { sessionId: ROOT, update: PAID })).toBe(false);
});
