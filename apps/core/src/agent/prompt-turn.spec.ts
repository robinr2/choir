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
  expect(prompt.start()).toBe(true);
  prompt.push(UPDATE);
  prompt.end({ stopReason: 'end_turn' });
  expect(await lastValueFrom(prompt.updates.pipe(toArray()))).toEqual([UPDATE]);
  expect(await prompt.result).toEqual({ stopReason: 'end_turn' });
  expect(prompt.start()).toBe(false);
});

it('withdraws a queued prompt without asking the agent', async () => {
  const { interrupt, prompt } = turn();
  await prompt.cancel();
  expect(await prompt.result).toBeUndefined();
  expect(prompt.start()).toBe(false);
  await prompt.cancel();
  expect(interrupt).not.toHaveBeenCalled();
});

it('asks the agent to cancel a running prompt', async () => {
  const { interrupt, prompt } = turn();
  prompt.start();
  await prompt.cancel();
  expect(interrupt).toHaveBeenCalledOnce();
});

it('fails its updates and its result when the prompt fails', async () => {
  const { prompt } = turn();
  prompt.start();
  prompt.fail(new Error('agent exited'));
  await expect(lastValueFrom(prompt.updates)).rejects.toThrow('agent exited');
  await expect(prompt.result).rejects.toThrow('agent exited');
});

it('leaves a failed prompt that nobody waits for unreported', async () => {
  const unhandled = vi.fn<(reason: unknown) => void>();
  process.on('unhandledRejection', unhandled);
  const { prompt } = turn();
  prompt.start();
  prompt.fail(new Error('agent exited'));
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  process.off('unhandledRejection', unhandled);
  expect(unhandled).not.toHaveBeenCalled();
});
