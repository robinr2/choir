import type { PromptResponse, SessionUpdate } from '@agentclientprotocol/sdk';
import { concat, from, lastValueFrom, throwError, toArray } from 'rxjs';
import type { AgentTurn } from '../agent/prompt-turn.js';
import { ConversationTurn } from './conversation-turn.js';

function agentTurn(
  updates: SessionUpdate[] = [],
  result: Promise<PromptResponse | undefined> = Promise.resolve({
    stopReason: 'end_turn',
  }),
) {
  return {
    updates: from(updates),
    result,
    cancel: vi.fn<AgentTurn['cancel']>().mockResolvedValue(),
  } satisfies AgentTurn;
}

function turnOf(
  agent: AgentTurn,
  early: boolean,
  onChange = vi.fn<() => void>(),
) {
  return new ConversationTurn(
    agent,
    {
      prompt: 'hello choir',
      words: 'hello choir',
      early,
      mark: { voice: true },
    },
    onChange,
  );
}

function says(text: string): SessionUpdate {
  return {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
  };
}

async function settled(
  promise: Promise<boolean>,
): Promise<boolean | 'pending'> {
  return Promise.race([promise, Promise.resolve('pending' as const)]);
}

it('confirms a turn that did not start early', async () => {
  expect(await turnOf(agentTurn(), false).confirmed).toBe(true);
});

it('holds an early turn until it is confirmed', async () => {
  const turn = turnOf(agentTurn(), true);
  expect(await settled(turn.confirmed)).toBe('pending');
  turn.confirm();
  expect(await turn.confirmed).toBe(true);
});

it('cancels the agent turn and refuses its tool calls', async () => {
  const agent = agentTurn();
  const turn = turnOf(agent, true);
  await turn.cancel();
  expect(agent.cancel).toHaveBeenCalledOnce();
  expect(await turn.confirmed).toBe(false);
});

it('streams only the answer text and follows every update', async () => {
  const onChange = vi.fn<() => void>();
  const turn = turnOf(
    agentTurn([
      {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: 'hmm' },
      },
      { sessionUpdate: 'tool_call', toolCallId: 'tool-1', title: 'Read' },
      says('Hello'),
    ]),
    true,
    onChange,
  );
  const answer = lastValueFrom(turn.answer.pipe(toArray()));
  expect(await turn.run()).toBe('end_turn: no token usage reported');
  expect(await answer).toEqual(['Hello']);
  expect(onChange).toHaveBeenCalledTimes(3);
  expect(turn.parts).toEqual([
    {
      type: 'tool-call',
      toolCallId: 'tool-1',
      toolName: 'Read',
      args: undefined,
    },
    { type: 'text', text: 'Hello' },
  ]);
  expect(await turn.confirmed).toBe(false);
  expect(await turn.result).toEqual({ stopReason: 'end_turn' });
  expect(await turn.settled).toBeUndefined();
});

it('says when a turn was withdrawn before it reached the agent', async () => {
  const turn = turnOf(agentTurn([], Promise.resolve(undefined)), false);
  expect(await turn.run()).toBe('withdrawn: no token usage reported');
});

it('ends the answer and refuses tool calls when the agent turn fails', async () => {
  const failure = new Error('agent exited');
  const agent = {
    ...agentTurn([], Promise.reject(failure)),
    updates: concat(
      from([says('Hel')]),
      throwError(() => failure),
    ),
  };
  const turn = turnOf(agent, true);
  const answer = lastValueFrom(turn.answer.pipe(toArray()));
  await expect(turn.run()).rejects.toThrow('agent exited');
  expect(await answer).toEqual(['Hel']);
  expect(await turn.confirmed).toBe(false);
  expect(await turn.settled).toBeUndefined();
});
