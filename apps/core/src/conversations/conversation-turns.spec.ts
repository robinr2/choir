import { lastValueFrom, toArray } from 'rxjs';
import { FakeSession } from '../test/fake-session.js';
import { newModel, stateOf } from './conversation-model.js';
import { ConversationTurns, type TurnHost } from './conversation-turns.js';
import { ConversationView } from './conversation-view.js';
import type { TurnRequest } from './turn-request.js';

let session: FakeSession;
let view: ConversationView;
let host: { [K in keyof TurnHost]: ReturnType<typeof vi.fn<TurnHost[K]>> };
let turns: ConversationTurns;

function typed(text: string, extra: Partial<TurnRequest> = {}): TurnRequest {
  return { prompt: text, words: text, early: false, mark: {}, ...extra };
}

function shown() {
  return view.state.messages.map(({ role, parts, steered }) => [
    role,
    parts.map((part) => ('text' in part ? part.text : part.type)).join(''),
    steered,
  ]);
}

async function flushed(): Promise<void> {
  await new Promise(setImmediate);
}

beforeEach(() => {
  session = new FakeSession();
  view = new ConversationView(newModel(0), stateOf);
  host = {
    session: vi.fn<TurnHost['session']>(async () => session),
    saveMark: vi.fn<TurnHost['saveMark']>(async () => undefined),
    changed: vi.fn<TurnHost['changed']>(),
    ended: vi.fn<TurnHost['ended']>(),
    follow: vi.fn<TurnHost['follow']>(),
  };
  turns = new ConversationTurns(view, host);
});

it('sends a turn at once, shows it and sums it up when it ends', async () => {
  const images = [{ data: 'aGk=', mimeType: 'image/png' }];
  const turn = turns.submit(typed('hello', { images }));
  expect(turns.busy).toBe(true);
  expect(host.follow).toHaveBeenCalledExactlyOnceWith(turn.settled);
  await flushed();
  expect(host.saveMark).toHaveBeenCalledExactlyOnceWith(turn.request);
  expect(session.prompts).toEqual([{ text: 'hello', images }]);
  expect(view.state.messages).toEqual([
    {
      id: 'm0',
      role: 'user',
      parts: [
        { type: 'text', text: 'hello' },
        { type: 'image', image: 'data:image/png;base64,aGk=' },
      ],
    },
  ]);
  session.latest.end();
  await flushed();
  expect(host.ended).toHaveBeenCalledExactlyOnceWith({
    summary: 'end_turn: no token usage reported',
  });
  expect(turns.busy).toBe(false);
  expect(turns.failed).toBe(false);
  expect(turns.gate.running).toBeUndefined();
});

it('queues turns while one runs and sends them one by one', async () => {
  turns.submit(typed('first'));
  const second = turns.submit(
    typed('second', { images: [{ data: 'aGk=', mimeType: 'image/png' }] }),
  );
  turns.submit(typed('third', { mark: { text: 'shown' } }));
  await flushed();
  expect(view.state.queue).toEqual([
    { id: second.id, text: 'second', images: 1 },
    { id: expect.any(String), text: 'shown', images: 0 },
  ]);
  session.latest.end();
  await flushed();
  expect(session.prompts.map(({ text }) => text)).toEqual(['first', 'second']);
  expect(view.state.queue.map(({ text }) => text)).toEqual(['shown']);
  expect(host.changed).toHaveBeenCalled();
});

it('removes queued turns and ends their answers', async () => {
  turns.submit(typed('first'));
  const second = turns.submit(typed('second'));
  expect(turns.remove('unknown')).toBe(false);
  expect(turns.remove(second.id)).toBe(true);
  expect(await lastValueFrom(second.answer.pipe(toArray()))).toEqual([]);
  expect(view.state.queue).toEqual([]);
  await flushed();
  session.latest.end();
  await flushed();
  expect(session.prompts.map(({ text }) => text)).toEqual(['first']);
});

it('sends the next turn as soon as the running one only waits for subagents', async () => {
  turns.submit(typed('first'));
  turns.submit(typed('second'));
  await flushed();
  turns.held();
  await flushed();
  expect(session.prompts.map(({ text }) => text)).toEqual(['first', 'second']);
  const [first, second] = session.turns;
  first?.end();
  await flushed();
  expect(turns.busy).toBe(true);
  expect(turns.gate.running?.request.prompt).toBe('second');
  turns.submit(typed('third'));
  await flushed();
  expect(session.prompts).toHaveLength(2);
  second?.end();
  await flushed();
  expect(session.prompts).toHaveLength(3);
});

it('steers the running turn, or sends the steering as a turn when none runs', async () => {
  await turns.steer({ text: 'idle steering' });
  expect(session.steer).not.toHaveBeenCalled();
  expect(await turns.gate.toolCallAllowed()).toBe(true);
  await flushed();
  expect(session.prompts.map(({ text }) => text)).toEqual(['idle steering']);
  await turns.steer({ text: 'use pnpm' });
  expect(session.steer).toHaveBeenCalledExactlyOnceWith({ text: 'use pnpm' });
  const queued = turns.submit(typed('use yarn'));
  expect(await turns.steerQueued('unknown')).toBe(false);
  expect(await turns.steerQueued(queued.id)).toBe(true);
  expect(view.state.queue).toEqual([]);
  session.steer.mockResolvedValueOnce(false);
  await turns.steer({ text: 'too late' });
  expect(shown()).toEqual([
    ['user', 'idle steering', undefined],
    ['user', 'use pnpm', true],
    ['user', 'use yarn', true],
    ['user', 'too late', true],
  ]);
  session.latest.end();
  await flushed();
  expect(session.prompts.map(({ text }) => text)).toEqual([
    'idle steering',
    'too late',
  ]);
  expect(shown()).toHaveLength(4);
});

it('cancels the running turn only when one runs', async () => {
  await turns.cancel();
  expect(session.cancel).not.toHaveBeenCalled();
  turns.submit(typed('long'));
  await turns.cancel();
  expect(session.cancel).toHaveBeenCalledOnce();
});

it('fails a turn the agent rejects and a turn without a session', async () => {
  turns.submit(typed('boom'));
  await flushed();
  session.latest.fail(new Error('agent exited'));
  await flushed();
  expect(host.ended).toHaveBeenLastCalledWith({
    error: new Error('agent exited'),
  });
  expect(turns.failed).toBe(true);
  turns.submit(typed('fine'));
  await flushed();
  expect(turns.failed).toBe(true);
  session.latest.end();
  await flushed();
  expect(turns.failed).toBe(false);
  host.session.mockRejectedValueOnce(new Error('no agent'));
  const lost = turns.submit(typed('lost'));
  await flushed();
  expect(await lastValueFrom(lost.answer.pipe(toArray()))).toEqual([]);
  expect(turns.failed).toBe(true);
  expect(turns.busy).toBe(false);
});

it('keeps the failure of an older turn from the newer one', async () => {
  turns.submit(typed('old'));
  await flushed();
  turns.held();
  turns.submit(typed('new'));
  await flushed();
  session.turns[0]?.fail(new Error('late'));
  await flushed();
  expect(turns.failed).toBe(false);
});
