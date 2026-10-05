import type { AnyMessage } from '@agentclientprotocol/sdk';
import { agentUpdate, carried, isSessionUpdate } from './agent-updates.js';

const SPAWNED = {
  sessionUpdate: 'subagent_spawned',
  subagentSessionId: 'child',
  name: 'Explore',
  task: 'Explore the code',
  capabilities: {},
};

const CHUNK = {
  sessionUpdate: 'agent_message_chunk',
  content: { type: 'text', text: 'hi' },
} as const;

function notification(update: object): AnyMessage {
  return {
    jsonrpc: '2.0',
    method: 'session/update',
    params: { sessionId: 'root', update },
  };
}

it('carries the subagent updates of the agent through the SDK and unpacks them again', () => {
  const update = {
    sessionUpdate: 'session_info_update',
    _meta: { 'choir/subagent': SPAWNED },
  } as const;
  expect(carried(notification(SPAWNED))).toEqual(notification(update));
  expect(agentUpdate({ sessionId: 'root', update })).toEqual({
    sessionId: 'root',
    update: SPAWNED,
  });
});

it('leaves every other message as it is', () => {
  const other = notification(CHUNK);
  const response: AnyMessage = { jsonrpc: '2.0', id: 1, result: {} };
  const unknown = notification({ ...SPAWNED, name: 1 });
  expect(carried(other)).toBe(other);
  expect(carried(response)).toBe(response);
  expect(carried(unknown)).toBe(unknown);
  expect(
    agentUpdate({
      sessionId: 'root',
      update: { sessionUpdate: 'session_info_update', title: 'Hi' },
    }),
  ).toEqual({
    sessionId: 'root',
    update: { sessionUpdate: 'session_info_update', title: 'Hi' },
  });
});

it('tells session updates from subagent updates', () => {
  const state = {
    sessionUpdate: 'subagent_state_update',
    subagentSessionId: 'child',
    state: 'failed',
  } as const;
  expect(isSessionUpdate(CHUNK)).toBe(true);
  expect(isSessionUpdate(state)).toBe(false);
});
