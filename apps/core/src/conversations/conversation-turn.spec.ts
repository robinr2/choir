import type { PromptResponse, SessionUpdate } from '@agentclientprotocol/sdk';
import { concat, from, lastValueFrom, throwError, toArray } from 'rxjs';
import type { AgentTurn } from '../agent/prompt-turn.js';
import { ConversationTurn } from './conversation-turn.js';
import type { TurnRequest } from './turn-request.js';

const REQUEST: TurnRequest = {
  prompt: 'hello choir',
  words: 'hello choir',
  early: false,
  mark: { voice: true },
};

function agentTurn(
  updates: SessionUpdate[] = [],
  result: Promise<PromptResponse> = Promise.resolve({ stopReason: 'end_turn' }),
) {
  return {
    updates: from(updates),
    result,
    cancel: vi.fn<AgentTurn['cancel']>().mockResolvedValue(),
  } satisfies AgentTurn;
}

function turnOf(request: Partial<TurnRequest> = {}) {
  const withdrawn = vi.fn<(turn: ConversationTurn) => void>();
  return {
    withdrawn,
    turn: new ConversationTurn({ ...REQUEST, ...request }, withdrawn),
  };
}

function says(text: string): SessionUpdate {
  return {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
  };
}

function settledYet(promise: Promise<unknown>): Promise<unknown> {
  return Promise.race([promise, Promise.resolve('pending')]);
}

it('confirms a turn that did not start early and holds an early one', async () => {
  expect(await turnOf().turn.confirmed).toBe(true);
  const { turn } = turnOf({ early: true });
  expect(await settledYet(turn.confirmed)).toBe('pending');
  turn.confirm();
  expect(await turn.confirmed).toBe(true);
});

it('sends its prompt with its images', () => {
  const images = [{ data: 'aGk=', mimeType: 'image/png' }];
  expect(turnOf().turn.content).toEqual({ text: 'hello choir' });
  expect(turnOf({ images }).turn.content).toEqual({
    text: 'hello choir',
    images,
  });
  expect(turnOf().turn.id).not.toBe(turnOf().turn.id);
});

it('streams the text of the answer and sums up the turn', async () => {
  const { turn } = turnOf();
  const answer = lastValueFrom(turn.answer.pipe(toArray()));
  const summary = await turn.run(
    agentTurn(
      [
        says('Hello'),
        {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'image', data: 'x', mimeType: 'image/png' },
        },
        {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'hm' },
        },
        says(' there'),
      ],
      Promise.resolve({
        stopReason: 'end_turn',
        _meta: {
          quota: {
            token_count: {
              inputTokens: 1,
              cachedInputTokens: 2,
              cachedWriteTokens: 3,
              outputTokens: 4,
            },
          },
        },
      }),
    ),
  );
  expect(summary).toBe(
    'end_turn: cache read 2, cache write 3, input 1, output 4',
  );
  expect(await answer).toEqual(['Hello', ' there']);
  expect(await settledYet(turn.settled)).toBeUndefined();
  expect(await turn.confirmed).toBe(true);
});

it('ends its answer and refuses tool calls when the agent fails', async () => {
  const { turn } = turnOf({ early: true });
  const result = Promise.reject(new Error('gone'));
  result.catch(() => undefined);
  const failing = agentTurn([], result);
  const run = turn.run({
    ...failing,
    updates: concat(
      from([says('Hi')]),
      throwError(() => new Error('gone')),
    ),
  });
  await expect(run).rejects.toThrow('gone');
  expect(await lastValueFrom(turn.answer.pipe(toArray()))).toEqual(['Hi']);
  expect(await turn.confirmed).toBe(false);
});

it('cancels the agent turn once it runs and withdraws it before', async () => {
  const { turn, withdrawn } = turnOf({ early: true });
  await turn.cancel();
  expect(withdrawn).toHaveBeenCalledExactlyOnceWith(turn);
  expect(await turn.confirmed).toBe(false);
  expect(await lastValueFrom(turn.answer.pipe(toArray()))).toEqual([]);
  expect(await settledYet(turn.settled)).toBeUndefined();
  const running = turnOf();
  const agent = agentTurn([], new Promise(() => undefined));
  void running.turn.run(agent);
  await running.turn.cancel();
  expect(agent.cancel).toHaveBeenCalledOnce();
  expect(running.withdrawn).not.toHaveBeenCalled();
});
