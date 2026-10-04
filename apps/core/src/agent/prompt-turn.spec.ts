import type { SessionUpdate } from '@agentclientprotocol/sdk';
import { lastValueFrom, toArray } from 'rxjs';
import { PromptTurn } from './prompt-turn.js';

const UPDATE: SessionUpdate = {
  sessionUpdate: 'agent_message_chunk',
  content: { type: 'text', text: 'Hi' },
};

function turn() {
  const interrupt = vi.fn<() => Promise<void>>(async () => undefined);
  return { interrupt, prompt: new PromptTurn(interrupt) };
}

it('passes on the updates of its prompt and ends with its response', async () => {
  const { prompt } = turn();
  prompt.push(UPDATE);
  prompt.end({ stopReason: 'end_turn' });
  expect(await lastValueFrom(prompt.updates.pipe(toArray()))).toEqual([UPDATE]);
  expect(await prompt.result).toEqual({ stopReason: 'end_turn' });
});

it('asks the agent to cancel a running prompt and not an ended one', async () => {
  const { interrupt, prompt } = turn();
  await prompt.cancel();
  expect(interrupt).toHaveBeenCalledOnce();
  prompt.end({ stopReason: 'cancelled' });
  await prompt.cancel();
  expect(interrupt).toHaveBeenCalledOnce();
});

it('fails its updates and its result when the prompt fails', async () => {
  const { interrupt, prompt } = turn();
  prompt.fail(new Error('agent exited'));
  await expect(lastValueFrom(prompt.updates)).rejects.toThrow('agent exited');
  await expect(prompt.result).rejects.toThrow('agent exited');
  await prompt.cancel();
  expect(interrupt).not.toHaveBeenCalled();
});

it('leaves a failed prompt that nobody waits for unreported', async () => {
  const unhandled = vi.fn<(reason: unknown) => void>();
  process.on('unhandledRejection', unhandled);
  const { prompt } = turn();
  prompt.fail(new Error('agent exited'));
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  process.off('unhandledRejection', unhandled);
  expect(unhandled).not.toHaveBeenCalled();
});
