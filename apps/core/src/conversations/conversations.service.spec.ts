import { firstValueFrom, lastValueFrom, Subject, take, toArray } from 'rxjs';
import type { ProfileService } from '../agent/profile.service.js';
import { FakeSession } from '../test/fake-session.js';
import type { VoiceService } from '../voice/voice.service.js';
import type { ConversationHost } from './conversation.js';
import type { Fork } from './conversation-state.js';
import { ConversationsService } from './conversations.service.js';
import type { TurnMark } from './transcript.js';

const ID = 'c1';
const TYPED = { early: false, voice: false };
const SPOKEN = { early: false, voice: true };
const SPOKEN_EARLY = { early: true, voice: true };
const UNFINISHED =
  "The user's last message was not finished. This message continues it.";

let sessions: Map<string, FakeSession>;
let savedMarks: [string, TurnMark][];
let working: Subject<ReadonlySet<string>>;
let host: {
  [K in keyof ConversationHost]: ReturnType<typeof vi.fn<ConversationHost[K]>>;
} & {
  workingChanges: Subject<ReadonlySet<string>>;
  link: ReturnType<
    typeof vi.fn<(id: string, sessionId: string, cwd: string) => Promise<void>>
  >;
  forget: ReturnType<typeof vi.fn<(id: string) => void>>;
};
let voiceAgent: string | undefined;
const voice = {
  isActive: vi.fn<VoiceService['isActive']>((id) => id === voiceAgent),
  speak: vi.fn<VoiceService['speak']>(),
};
const profile = {
  voicePrompt: vi.fn<ProfileService['voicePrompt']>(
    async () => 'Speak plainly.',
  ),
};
let conversations: ConversationsService;

function session(id = ID): FakeSession {
  const found = sessions.get(id);
  if (!found) throw new Error(`No session for ${id}`);
  return found;
}

function prompts(id = ID): string[] {
  return session(id).prompts.map(({ text }) => text);
}

async function flushed(): Promise<void> {
  await new Promise(setImmediate);
}

async function say(text: string, kind = TYPED) {
  const answer = await conversations.addUserTurn(ID, { text }, kind);
  await flushed();
  return answer;
}

async function ended(): Promise<void> {
  session().latest.end();
  await flushed();
}

beforeEach(() => {
  vi.clearAllMocks();
  sessions = new Map();
  savedMarks = [];
  voiceAgent = undefined;
  working = new Subject();
  host = {
    open: vi.fn<ConversationHost['open']>(async (id) => {
      const opened = new FakeSession(`session-${id}`);
      opened.emit({
        sessionUpdate: 'user_message_chunk',
        content: { type: 'text', text: 'hi' },
      });
      opened.emit({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'Hello.' },
      });
      sessions.set(id, opened);
      return opened;
    }),
    close: vi.fn<ConversationHost['close']>(async () => undefined),
    catalog: vi.fn<ConversationHost['catalog']>(async () => null),
    loadMarks: vi.fn<ConversationHost['loadMarks']>(
      async () => new Map(savedMarks),
    ),
    saveMarks: vi.fn<ConversationHost['saveMarks']>(async () => undefined),
    usage: vi.fn<ConversationHost['usage']>(),
    ended: vi.fn<ConversationHost['ended']>(),
    follow: vi.fn<ConversationHost['follow']>(),
    workingChanges: working,
    link: vi.fn<(id: string, sessionId: string, cwd: string) => Promise<void>>(
      async () => undefined,
    ),
    forget: vi.fn<(id: string) => void>(),
  };
  conversations = new ConversationsService(host, voice, profile);
});

it('opens each conversation once and shows what its session holds', async () => {
  const history = [
    { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'Hello.' }] },
  ];
  expect((await conversations.state(ID)).messages).toEqual(history);
  expect((await firstValueFrom(conversations.changes(ID))).messages).toEqual(
    history,
  );
  expect(await conversations.session(ID)).toEqual({
    id: 'session-c1',
    cwd: '/work',
  });
  await conversations.state('c2');
  expect(host.open.mock.calls).toEqual([[ID], ['c2']]);
  expect(conversations.workingChanges).toBe(working);
});

it('streams the answer and shows the turn while it runs', async () => {
  const answer = await say('what is new');
  session().latest.says('Nothing.');
  await ended();
  expect(await lastValueFrom(answer.pipe(toArray()))).toEqual(['Nothing.']);
  expect(prompts()).toEqual(['what is new']);
  expect((await conversations.state(ID)).messages.slice(2)).toEqual([
    { id: 'm2', role: 'user', parts: [{ type: 'text', text: 'what is new' }] },
  ]);
});

it('steers, removes queued turns, cancels, answers and configures through the conversation', async () => {
  await say('first');
  const queued = conversations.addUserTurn(ID, { text: 'second' }, TYPED);
  await queued;
  const [item] = (await conversations.state(ID)).queue;
  expect(conversations.removeQueued(ID, 'unknown')).toBe(false);
  expect(await conversations.steerQueued(ID, item?.id ?? '')).toBe(true);
  await conversations.steer(ID, { text: 'more' });
  expect(session().steer.mock.calls).toEqual([
    [{ text: 'second' }],
    [{ text: 'more' }],
  ]);
  await conversations.cancel(ID);
  expect(session().cancel).toHaveBeenCalledOnce();
  expect(await conversations.respond(ID, 'i1', { optionId: 'yes' })).toBe(
    'answered',
  );
  await conversations.configure(ID, { mode: 'plan' });
  expect(session().setConfigOption).toHaveBeenCalledExactlyOnceWith(
    'mode',
    'plan',
  );
});

it('switches the session of a conversation and follows its forks', async () => {
  await conversations.state(ID);
  await conversations.switchSession(ID, 's2', '/other');
  expect(host.link).toHaveBeenCalledExactlyOnceWith(ID, 's2', '/other');
  expect(host.open).toHaveBeenCalledTimes(2);
  const forks = new Subject<Fork>();
  conversations.followFork(ID, forks);
  forks.next({
    id: 'f1',
    sessionId: 's3',
    title: 'Fork',
    state: 'ready',
    startedAt: 1,
    endedAt: 2,
  });
  expect((await conversations.state(ID)).forks).toHaveLength(1);
});

it('lets tool calls through only once an early turn is confirmed', async () => {
  expect(await conversations.toolCallAllowed(ID)).toBe(false);
  await say('hello', SPOKEN_EARLY);
  const allowed = conversations.toolCallAllowed(ID);
  conversations.confirm(ID, 'hi');
  conversations.confirm(ID, 'hello');
  expect(await allowed).toBe(true);
  await ended();
  expect(await conversations.toolCallAllowed(ID)).toBe(false);
});

it('withdraws an early turn and sends only the rest of what the user says', async () => {
  await conversations.withdraw(ID);
  await say('hello', SPOKEN_EARLY);
  const allowed = conversations.toolCallAllowed(ID);
  await conversations.withdraw(ID);
  expect(session().latest.cancel).toHaveBeenCalledOnce();
  expect(await allowed).toBe(false);
  await say('hello choir');
  await say('thanks');
  expect(prompts()).toEqual(['hello', 'choir']);
  expect(host.saveMarks).toHaveBeenLastCalledWith(
    ID,
    new Map([['hello', { voice: true, aloud: true, heard: '' }]]),
  );
  expect(await conversations.promptContext(ID, 'choir')).toBe(UNFINISHED);
  expect(await conversations.promptContext(ID, 'thanks')).toBe('');
  await ended();
  expect(prompts()).toEqual(['hello', 'choir', 'thanks']);
});

it('withdraws a queued early turn before it reaches the agent', async () => {
  await say('typed');
  const early = await conversations.addUserTurn(
    ID,
    { text: 'maybe' },
    SPOKEN_EARLY,
  );
  await conversations.withdraw(ID);
  expect(await lastValueFrom(early.pipe(toArray()))).toEqual([]);
  expect((await conversations.state(ID)).queue).toEqual([]);
  await ended();
  expect(prompts()).toEqual(['typed']);
});

it('withdraws nothing once the turn did not start early', async () => {
  await say('hello');
  await conversations.withdraw(ID);
  expect(session().latest.cancel).not.toHaveBeenCalled();
});

it('cancels an interrupted turn and tells what the user heard', async () => {
  await conversations.interrupt(ID, 'nothing');
  await say('tell me a story');
  expect(await conversations.promptContext(ID, 'tell me a story')).toBe(
    'The user interrupted your last answer after hearing only: "nothing".',
  );
  await conversations.interrupt(ID, 'Once upon');
  expect(session().latest.cancel).toHaveBeenCalledOnce();
  await flushed();
  await say('a shorter one');
  expect(prompts()).toEqual(['tell me a story', 'a shorter one']);
  expect(await conversations.promptContext(ID, 'a shorter one')).toBe(
    'The user interrupted your last answer after hearing only: "Once upon".',
  );
  expect(host.saveMarks).not.toHaveBeenCalled();
});

it('remembers how much of a spoken reply the user heard', async () => {
  await say('tell me a story', SPOKEN);
  session().emit({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'Once upon a time.' },
  });
  await ended();
  await conversations.interrupt(ID, 'Once upon');
  expect(host.saveMarks).toHaveBeenLastCalledWith(
    ID,
    new Map([
      ['tell me a story', { voice: true, aloud: true, heard: 'Once upon' }],
    ]),
  );
  expect((await conversations.state(ID)).messages.at(-1)).toEqual({
    id: 'm3',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Once upon a time.' }],
    spoken: true,
    heard: 'Once upon',
  });
});

it('adds the voice rules and the continuation note to the prompt of a turn', async () => {
  await conversations.interrupt(ID, 'Once');
  await say('go on', SPOKEN);
  await say('typed');
  await say('aloud', SPOKEN);
  expect(await conversations.promptContext(ID, ' go on\n')).toBe(
    'Speak plainly.\n\nThe user interrupted your last answer after hearing only: "Once".',
  );
  expect(await conversations.promptContext(ID, 'aloud')).toBe('Speak plainly.');
  expect(await conversations.promptContext(ID, 'typed')).toBe('');
  expect(await conversations.promptContext(ID, 'unknown')).toBe('');
  await ended();
  expect(await conversations.promptContext(ID, 'go on')).toBe('');
});

it('speaks typed turns to the voice agent and sends messages of other agents', async () => {
  voiceAgent = ID;
  const answer = await say('typed aloud');
  expect(voice.speak).toHaveBeenCalledExactlyOnceWith(ID, expect.anything());
  await ended();
  expect(await lastValueFrom(answer.pipe(toArray()))).toEqual([]);
  await conversations.sendMessage(ID, 'hi there', { id: 'a2', name: 'helper' });
  await flushed();
  expect(prompts().at(-1)).toMatch(
    /^\(A message from the agent "helper", ID a2\./,
  );
  expect(voice.speak).toHaveBeenCalledTimes(2);
  voiceAgent = undefined;
  await ended();
  await conversations.sendMessage(ID, 'quiet', { id: 'a2', name: 'helper' });
  await say('spoken', SPOKEN);
  expect(voice.speak).toHaveBeenCalledTimes(2);
  const { messages } = await conversations.state(ID);
  expect(messages.map(({ role, from }) => [role, from])).toContainEqual([
    'user',
    { id: 'a2', name: 'helper' },
  ]);
});

it('never withdraws a message from another agent', async () => {
  await conversations.sendMessage(ID, 'hi', { id: 'a2', name: 'helper' });
  await flushed();
  await conversations.withdraw(ID);
  expect(session().latest.cancel).not.toHaveBeenCalled();
  expect(await conversations.toolCallAllowed(ID)).toBe(true);
});

it('forgets a closed conversation and ends its session', async () => {
  await conversations.close(ID);
  expect(host.forget).not.toHaveBeenCalled();
  await say('hello');
  const updates = lastValueFrom(
    conversations.changes(ID).pipe(take(1000), toArray()),
  );
  await conversations.close(ID);
  expect(host.forget).toHaveBeenCalledExactlyOnceWith(ID);
  expect(host.close).toHaveBeenCalledExactlyOnceWith(session());
  await updates;
  await conversations.state(ID);
  expect(host.open).toHaveBeenCalledTimes(2);
});

it('keeps a confirmation that arrives before its early turn', async () => {
  conversations.confirm(ID, 'hello');
  await say('hello', SPOKEN_EARLY);
  expect(await conversations.toolCallAllowed(ID)).toBe(true);
  conversations.confirm(ID, 'later');
  await ended();
  await say('other', SPOKEN_EARLY);
  await ended();
  await say('later', SPOKEN_EARLY);
  const unconfirmed = await Promise.race([
    conversations.toolCallAllowed(ID),
    Promise.resolve('pending'),
  ]);
  expect(unconfirmed).toBe('pending');
});
