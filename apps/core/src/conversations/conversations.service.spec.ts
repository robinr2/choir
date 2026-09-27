import { Logger } from '@nestjs/common';
import type {
  AcpRuntimeEvent,
  AcpRuntimeHandle,
  AcpRuntimeTurn,
  AcpRuntimeTurnResult,
  AcpSessionRecord,
} from 'acpx/runtime';
import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import type { MockInstance } from 'vitest';
import {
  type ConversationAgent,
  ConversationsService,
} from './conversations.service.js';
import type { TurnMark } from './transcript.js';
import type { ProfileService } from '../agent/profile.service.js';
import type { VoiceService } from '../voice/voice.service.js';
import type { TurnMarksService } from './turn-marks.service.js';

class ScriptedTurn implements AcpRuntimeTurn {
  readonly requestId = 'request-1';
  readonly promptStarted = Promise.resolve();
  readonly events: ReadableStream<AcpRuntimeEvent>;
  readonly result: Promise<AcpRuntimeTurnResult>;
  readonly cancel = vi.fn<AcpRuntimeTurn['cancel']>(async () =>
    this.end({ status: 'cancelled' }),
  );
  readonly closeStream = vi.fn<AcpRuntimeTurn['closeStream']>();
  private readonly finished = Promise.withResolvers<AcpRuntimeTurnResult>();
  private stream?: ReadableStreamDefaultController<AcpRuntimeEvent>;

  constructor(private readonly failure?: Error) {
    this.events = new ReadableStream({
      start: (controller) => {
        this.stream = controller;
      },
    });
    this.result = this.finished.promise;
  }

  emit(event: AcpRuntimeEvent): void {
    this.stream?.enqueue(event);
  }

  end(result: AcpRuntimeTurnResult): void {
    this.finished.resolve(result);
    if (this.failure) this.stream?.error(this.failure);
    else this.stream?.close();
  }
}

const ID = 'c1';
const TYPED = { early: false, voice: false };
const SPOKEN = { early: false, voice: true };
const SPOKEN_EARLY = { early: true, voice: true };

const handle: AcpRuntimeHandle = {
  sessionKey: ID,
  backend: 'acpx',
  runtimeSessionName: ID,
};

type Messages = AcpSessionRecord['messages'];

function user(text: string): Messages[number] {
  return { User: { id: text, content: [{ Text: text }] } };
}

function agentSaid(text: string): Messages[number] {
  return { Agent: { content: [{ Text: text }], tool_results: {} } };
}

let saved: Messages;
let turns: ScriptedTurn[];
let failure: Error | undefined;
const agent = {
  open: vi.fn<ConversationAgent['open']>(async () => handle),
  record: vi.fn<ConversationAgent['record']>(async () => ({ messages: saved })),
  startTurn: vi.fn<ConversationAgent['startTurn']>(() => {
    const turn = new ScriptedTurn(failure);
    turns.push(turn);
    return turn;
  }),
  close: vi.fn<ConversationAgent['close']>(async () => undefined),
} satisfies ConversationAgent;

let savedMarks: [string, TurnMark][];
const turnMarks = {
  load: vi.fn<TurnMarksService['load']>(async () => new Map(savedMarks)),
  save: vi.fn<TurnMarksService['save']>(async () => undefined),
};

let voiceAgent: string | undefined;
const voiceChannel = {
  isActive: vi.fn<VoiceService['isActive']>((id) => id === voiceAgent),
  speak: vi.fn<VoiceService['speak']>(),
};

const profile = {
  voicePrompt: vi.fn<ProfileService['voicePrompt']>(
    async () => 'Speak plainly.',
  ),
};

const UNFINISHED =
  "The user's last message was not finished. This message continues it.";

let conversations: ConversationsService;
let log: MockInstance<Logger['log']>;
let logError: MockInstance<Logger['error']>;

function latestTurn(): ScriptedTurn {
  const turn = turns.at(-1);
  if (!turn) throw new Error('No turn started');
  return turn;
}

async function reloaded(times: number): Promise<void> {
  await vi.waitFor(() => expect(agent.record).toHaveBeenCalledTimes(times));
}

function prompts(): string[] {
  return agent.startTurn.mock.calls.map(([, text]) => text);
}

beforeEach(() => {
  vi.clearAllMocks();
  log = vi.spyOn(Logger.prototype, 'log').mockReturnValue();
  logError = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
  saved = [user('hi'), agentSaid('Hello.')];
  turns = [];
  failure = undefined;
  savedMarks = [];
  voiceAgent = undefined;
  conversations = new ConversationsService(
    agent,
    turnMarks,
    voiceChannel,
    profile,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('opens each session once and shows what it holds', async () => {
  const history = [
    { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'Hello.' }] },
  ];
  expect(await conversations.messages(ID)).toEqual(history);
  expect(await firstValueFrom(conversations.updates(ID))).toEqual(history);
  await conversations.messages('c2');
  expect(agent.open.mock.calls).toEqual([[ID], ['c2']]);
});

it('streams the answer and shows the turn while it runs', async () => {
  const answer = await conversations.addUserTurn(ID, 'what is new', TYPED);
  const shown = lastValueFrom(
    conversations.updates(ID).pipe(take(2), toArray()),
  );
  latestTurn().emit({ type: 'text_delta', text: 'Nothing.' });
  const [started, live] = await shown;
  const asked = {
    id: 'm2',
    role: 'user',
    parts: [{ type: 'text', text: 'what is new' }],
  };
  expect(started?.slice(2)).toEqual([
    asked,
    { id: 'm3', role: 'assistant', parts: [] },
  ]);
  expect(live?.slice(2)).toEqual([
    asked,
    {
      id: 'm3',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Nothing.' }],
    },
  ]);
  expect(prompts()).toEqual(['what is new']);
  saved = [...saved, user('what is new'), agentSaid('Nothing.')];
  latestTurn().end({
    status: 'completed',
    _meta: {
      quota: {
        token_count: {
          inputTokens: 2,
          cachedInputTokens: 900,
          cachedWriteTokens: 40,
          outputTokens: 5,
        },
      },
    },
  });
  expect(await lastValueFrom(answer.pipe(toArray()))).toEqual(['Nothing.']);
  await reloaded(2);
  expect(log).toHaveBeenCalledExactlyOnceWith(
    'Conversation c1 turn completed: cache read 900, cache write 40, input 2, output 5',
  );
  expect(await conversations.messages(ID)).toHaveLength(4);
});

it('lets tool calls through only once an early turn is confirmed', async () => {
  expect(await conversations.toolCallAllowed(ID)).toBe(false);
  await conversations.addUserTurn(ID, 'hello', SPOKEN_EARLY);
  const allowed = conversations.toolCallAllowed(ID);
  conversations.confirm(ID, 'hi');
  conversations.confirm(ID, 'hello');
  expect(await allowed).toBe(true);
  latestTurn().end({ status: 'completed' });
  await reloaded(2);
  expect(await conversations.toolCallAllowed(ID)).toBe(false);
});

it('withdraws an early turn and sends only the rest of what the user says', async () => {
  await conversations.withdraw(ID);
  await conversations.addUserTurn(ID, 'hello', SPOKEN_EARLY);
  const allowed = conversations.toolCallAllowed(ID);
  await conversations.withdraw(ID);
  expect(latestTurn().cancel).toHaveBeenCalledOnce();
  expect(await allowed).toBe(false);
  await conversations.addUserTurn(ID, 'hello choir', TYPED);
  await conversations.addUserTurn(ID, 'thanks', TYPED);
  expect(prompts()).toEqual(['hello', 'choir', 'thanks']);
  expect(turnMarks.save).toHaveBeenLastCalledWith(
    ID,
    new Map([['hello', { voice: true, aloud: true, heard: '' }]]),
  );
  expect(await conversations.promptContext(ID, 'choir')).toBe(UNFINISHED);
  expect(await conversations.promptContext(ID, 'thanks')).toBe('');
});

it('withdraws nothing once the turn did not start early', async () => {
  await conversations.addUserTurn(ID, 'hello', TYPED);
  await conversations.withdraw(ID);
  expect(latestTurn().cancel).not.toHaveBeenCalled();
  await conversations.addUserTurn(ID, 'again', TYPED);
  expect(prompts()).toEqual(['hello', 'again']);
});

it('cancels an interrupted turn and tells what the user heard', async () => {
  await conversations.interrupt(ID, 'nothing');
  await conversations.addUserTurn(ID, 'tell me a story', TYPED);
  expect(await conversations.promptContext(ID, 'tell me a story')).toBe(
    'The user interrupted your last answer after hearing only: "nothing".',
  );
  await conversations.interrupt(ID, 'Once upon');
  expect(latestTurn().cancel).toHaveBeenCalledOnce();
  await conversations.addUserTurn(ID, 'a shorter one', TYPED);
  expect(prompts()).toEqual(['tell me a story', 'a shorter one']);
  expect(await conversations.promptContext(ID, 'a shorter one')).toBe(
    'The user interrupted your last answer after hearing only: "Once upon".',
  );
  expect(turnMarks.save).not.toHaveBeenCalled();
});

it('remembers how much of a spoken reply the user heard', async () => {
  await conversations.addUserTurn(ID, 'tell me a story', SPOKEN);
  const story = latestTurn();
  story.emit({ type: 'text_delta', text: 'Once upon a time.' });
  story.end({ status: 'completed' });
  saved = [...saved, user('tell me a story'), agentSaid('Once upon a time.')];
  await reloaded(2);
  await conversations.interrupt(ID, 'Once upon');
  expect(turnMarks.save).toHaveBeenLastCalledWith(
    ID,
    new Map([
      ['tell me a story', { voice: true, aloud: true, heard: 'Once upon' }],
    ]),
  );
  expect((await conversations.messages(ID)).at(-1)).toEqual({
    id: 'm3',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Once upon a time.' }],
    spoken: true,
    heard: 'Once upon',
  });
});

it('keeps showing a newer turn when an older one finishes', async () => {
  await conversations.addUserTurn(ID, 'first', TYPED);
  const first = latestTurn();
  await conversations.addUserTurn(ID, 'second', TYPED);
  first.end({ status: 'completed' });
  await reloaded(2);
  expect((await conversations.messages(ID)).at(-2)).toEqual({
    id: 'm2',
    role: 'user',
    parts: [{ type: 'text', text: 'second' }],
  });
  expect(await conversations.toolCallAllowed(ID)).toBe(true);
});

it('logs a turn the agent could not finish', async () => {
  failure = new Error('agent exited');
  await conversations.addUserTurn(ID, 'hello', TYPED);
  latestTurn().end({ status: 'failed', error: { message: 'agent exited' } });
  await vi.waitFor(() =>
    expect(logError).toHaveBeenCalledExactlyOnceWith(
      'Conversation c1 turn failed: Error: agent exited',
    ),
  );
  expect(log).not.toHaveBeenCalled();
});

it('adds the voice rules and the continuation note to the prompt of a turn', async () => {
  await conversations.interrupt(ID, 'Once');
  await conversations.addUserTurn(ID, 'go on', SPOKEN);
  const spoken = latestTurn();
  await conversations.addUserTurn(ID, 'typed', TYPED);
  await conversations.addUserTurn(ID, 'aloud', SPOKEN);
  expect(await conversations.promptContext(ID, ' go on\n')).toBe(
    'Speak plainly.\n\nThe user interrupted your last answer after hearing only: "Once".',
  );
  expect(await conversations.promptContext(ID, 'aloud')).toBe('Speak plainly.');
  expect(await conversations.promptContext(ID, 'typed')).toBe('');
  expect(await conversations.promptContext(ID, 'unknown')).toBe('');
  spoken.end({ status: 'completed' });
  await reloaded(2);
  expect(await conversations.promptContext(ID, 'go on')).toBe('');
});

it('marks spoken exchanges while they run and once they are saved', async () => {
  savedMarks = [['hi', { voice: true, aloud: true }]];
  await conversations.addUserTurn(ID, 'tell me', SPOKEN);
  latestTurn().emit({ type: 'text_delta', text: 'Sure.' });
  await vi.waitFor(async () =>
    expect((await conversations.messages(ID)).at(-1)?.parts).toHaveLength(1),
  );
  expect(
    (await conversations.messages(ID)).map(({ spoken }) => spoken),
  ).toEqual([undefined, true, undefined, true]);
  expect(turnMarks.load).toHaveBeenCalledExactlyOnceWith(ID);
  expect(turnMarks.save).toHaveBeenCalledExactlyOnceWith(
    ID,
    new Map([
      ['hi', { voice: true, aloud: true }],
      ['tell me', { voice: true, aloud: true }],
    ]),
  );
  expect(voiceChannel.speak).not.toHaveBeenCalled();
  saved = [...saved, user('tell me'), agentSaid('Sure.')];
  latestTurn().end({ status: 'completed' });
  await reloaded(2);
  expect(
    (await conversations.messages(ID)).map(({ spoken }) => spoken),
  ).toEqual([undefined, true, undefined, true]);
  await conversations.addUserTurn(ID, 'typed', TYPED);
  expect(turnMarks.save).toHaveBeenCalledOnce();
  expect(
    (await conversations.messages(ID)).slice(-2).map(({ spoken }) => spoken),
  ).toEqual([undefined, undefined]);
});

it('keeps a confirmation that arrives before its early turn', async () => {
  conversations.confirm(ID, 'hello');
  await conversations.addUserTurn(ID, 'hello', SPOKEN_EARLY);
  expect(await conversations.toolCallAllowed(ID)).toBe(true);
  conversations.confirm(ID, 'later');
  await conversations.addUserTurn(ID, 'other', SPOKEN_EARLY);
  await conversations.addUserTurn(ID, 'later', SPOKEN_EARLY);
  const unconfirmed = await Promise.race([
    conversations.toolCallAllowed(ID),
    Promise.resolve('pending'),
  ]);
  expect(unconfirmed).toBe('pending');
});

it('never withdraws a message from another agent', async () => {
  await conversations.sendMessage(ID, 'hi', { id: 'a2', name: 'helper' });
  await conversations.withdraw(ID);
  expect(latestTurn().cancel).not.toHaveBeenCalled();
  expect(await conversations.toolCallAllowed(ID)).toBe(true);
});

it('forgets a closed conversation and stops following it', async () => {
  const working = firstValueFrom(
    conversations.workingChanges.pipe(take(3), toArray()),
  );
  await conversations.addUserTurn(ID, 'hello', TYPED);
  const updates = lastValueFrom(conversations.updates(ID).pipe(toArray()));
  await conversations.close(ID);
  expect(await working).toEqual([new Set(), new Set([ID]), new Set()]);
  expect(await updates).toEqual([]);
  await conversations.messages(ID);
  expect(agent.open).toHaveBeenCalledTimes(2);
});

it('ends only the sessions it opened when a conversation closes', async () => {
  await conversations.close(ID);
  conversations.confirm(ID, 'hello');
  await conversations.close(ID);
  expect(agent.close).not.toHaveBeenCalled();
  await conversations.messages(ID);
  await conversations.close(ID);
  expect(agent.close).toHaveBeenCalledExactlyOnceWith(handle);
});
