import type { AcpRuntimeEvent, AcpRuntimeTurn } from 'acpx/runtime';
import { lastValueFrom, toArray } from 'rxjs';
import { ConversationTurn } from './conversation-turn.js';

async function* stream(events: AcpRuntimeEvent[], failure?: Error) {
  yield* events;
  if (failure) throw failure;
}

function agentTurn(events: AcpRuntimeEvent[] = [], failure?: Error) {
  return {
    requestId: 'request-1',
    promptStarted: Promise.resolve(),
    events: stream(events, failure),
    result: Promise.resolve({ status: 'completed' as const }),
    cancel: vi.fn<AcpRuntimeTurn['cancel']>().mockResolvedValue(),
    closeStream: vi.fn<AcpRuntimeTurn['closeStream']>().mockResolvedValue(),
  } satisfies AcpRuntimeTurn;
}

function turnOf(
  agent: AcpRuntimeTurn,
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

it('streams only the answer text and follows every event', async () => {
  const onChange = vi.fn<() => void>();
  const turn = turnOf(
    agentTurn([
      { type: 'text_delta', text: 'hmm', stream: 'thought' },
      { type: 'tool_call', text: '', toolCallId: 'tool-1', title: 'Read' },
      { type: 'text_delta', text: 'Hello' },
    ]),
    true,
    onChange,
  );
  const answer = lastValueFrom(turn.answer.pipe(toArray()));
  expect(await turn.run()).toBe('completed: no token usage reported');
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
  expect(await turn.settled).toEqual({ status: 'completed' });
});

it('ends the answer and refuses tool calls when the agent turn fails', async () => {
  const turn = turnOf(
    agentTurn([{ type: 'text_delta', text: 'Hel' }], new Error('agent exited')),
    true,
  );
  const answer = lastValueFrom(turn.answer.pipe(toArray()));
  await expect(turn.run()).rejects.toThrow('agent exited');
  expect(await answer).toEqual(['Hel']);
  expect(await turn.confirmed).toBe(false);
});
