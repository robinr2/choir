import { firstValueFrom, Subject, take, toArray } from 'rxjs';
import type { AgentCatalog } from '../agent/agent-catalog.js';
import { FakeSession } from '../test/fake-session.js';
import { Conversation, type ConversationHost } from './conversation.js';
import type { Fork } from './conversation-state.js';
import type { TurnMark } from './transcript.js';

const CATALOG: AgentCatalog = {
  models: [],
  modes: [],
  defaults: { cwd: '/w', model: null, effort: null, mode: 'bypassPermissions' },
};

type Mocked = {
  [K in keyof ConversationHost]: ReturnType<typeof vi.fn<ConversationHost[K]>>;
};

let sessions: FakeSession[];
let saved: Map<string, TurnMark>;
let host: Mocked;
let conversation: Conversation;

async function flushed(): Promise<void> {
  await new Promise(setImmediate);
}

function latest(): FakeSession {
  const session = sessions.at(-1);
  if (!session) throw new Error('No session opened');
  return session;
}

beforeEach(() => {
  sessions = [];
  saved = new Map([['hi', { aloud: true }]]);
  host = {
    open: vi.fn<ConversationHost['open']>(async () => {
      const session = new FakeSession(`s${sessions.length + 1}`);
      sessions.push(session);
      return session;
    }),
    close: vi.fn<ConversationHost['close']>(async () => undefined),
    catalog: vi.fn<ConversationHost['catalog']>(async () => CATALOG),
    loadMarks: vi.fn<ConversationHost['loadMarks']>(async () => new Map(saved)),
    saveMarks: vi.fn<ConversationHost['saveMarks']>(async () => undefined),
    usage: vi.fn<ConversationHost['usage']>(),
    ended: vi.fn<ConversationHost['ended']>(),
    follow: vi.fn<ConversationHost['follow']>(),
  };
  conversation = new Conversation('c1', host);
});

it('opens its session once and starts idle with its marks and the catalog', async () => {
  expect(conversation.state.status.state).toBe('starting');
  const opened = await conversation.ready();
  expect(await conversation.ready()).toBe(opened);
  const session = latest();
  expect(opened).toBe(session);
  expect(host.open).toHaveBeenCalledExactlyOnceWith('c1');
  expect(host.loadMarks).toHaveBeenCalledExactlyOnceWith('c1');
  await flushed();
  expect(conversation.state).toMatchObject({
    session: { id: 's1', cwd: '/work', title: null },
    status: { state: 'idle' },
  });
  session.configOptions.next([
    {
      id: 'model',
      name: 'Model',
      type: 'select',
      currentValue: 'opus',
      options: [],
    },
  ]);
  expect(conversation.state.settings).toMatchObject({
    model: 'opus',
    mode: 'bypassPermissions',
  });
  session.emit({ sessionUpdate: 'usage_update', used: 1, size: 2 });
  expect(host.usage).toHaveBeenCalledOnce();
});

it('works, waits and fails with its turns', async () => {
  await conversation.ready();
  const session = latest();
  const states = firstValueFrom(conversation.changes.pipe(take(1)));
  expect((await states).status.state).toBe('idle');
  conversation.turns.submit({
    prompt: 'hi',
    words: 'hi',
    early: false,
    mark: { aloud: true },
  });
  expect(conversation.state.status.state).toBe('working');
  expect(host.follow).toHaveBeenCalledExactlyOnceWith(
    'c1',
    expect.any(Promise),
  );
  session.interactions.next({
    type: 'requested',
    interaction: {
      id: 'i1',
      kind: 'permission',
      request: { sessionId: 's1', toolCall: { toolCallId: 't1' }, options: [] },
    },
  });
  expect(conversation.state.status.state).toBe('waiting');
  await flushed();
  expect(host.saveMarks).toHaveBeenCalledExactlyOnceWith(
    'c1',
    new Map([['hi', { aloud: true }]]),
  );
  session.latest.fail(new Error('gone'));
  session.interactions.next({
    type: 'settled',
    id: 'i1',
    answer: { action: 'cancel' },
  });
  await flushed();
  expect(conversation.state.status.state).toBe('failed');
  expect(host.ended).toHaveBeenCalledExactlyOnceWith('c1', {
    error: new Error('gone'),
  });
  conversation.turns.submit({
    prompt: 'plain',
    words: 'plain',
    early: false,
    mark: {},
  });
  await flushed();
  expect(host.saveMarks).toHaveBeenCalledOnce();
});

it('answers what the agent asks through its session', async () => {
  await conversation.ready();
  const session = latest();
  expect(await conversation.respond('i1', { optionId: 'yes' })).toBe(
    'answered',
  );
  expect(session.respond).toHaveBeenCalledExactlyOnceWith('i1', {
    optionId: 'yes',
  });
});

it('sets the model, then the effort, then the mode', async () => {
  await conversation.ready();
  const session = latest();
  await conversation.configure({ mode: 'plan', effort: 'high', model: 'opus' });
  await conversation.configure({ effort: 'low' });
  expect(session.setConfigOption.mock.calls).toEqual([
    ['model', 'opus'],
    ['effort', 'high'],
    ['mode', 'plan'],
    ['effort', 'low'],
  ]);
});

it('remembers what the user heard of a spoken reply', async () => {
  await conversation.ready();
  await conversation.markHeard(undefined, 'x');
  await conversation.markHeard(
    { prompt: 'typed', words: 'typed', early: false, mark: {} },
    'x',
  );
  expect(host.saveMarks).not.toHaveBeenCalled();
  await conversation.markHeard(
    { prompt: 'told', words: 'told', early: false, mark: { aloud: true } },
    'Once',
  );
  expect(host.saveMarks).toHaveBeenCalledExactlyOnceWith(
    'c1',
    new Map([
      ['hi', { aloud: true }],
      ['told', { aloud: true, heard: 'Once' }],
    ]),
  );
});

it('lists its forks as they change', async () => {
  const forks = new Subject<Fork>();
  conversation.follow(forks);
  const fork: Fork = {
    id: 'f1',
    sessionId: 's9',
    title: 'Fork',
    state: 'running',
    startedAt: 1,
    endedAt: null,
  };
  forks.next(fork);
  forks.next({ ...fork, id: 'f2' });
  forks.next({ ...fork, state: 'ready', endedAt: 2 });
  expect(conversation.state.forks.map(({ id, state }) => [id, state])).toEqual([
    ['f2', 'running'],
    ['f1', 'ready'],
  ]);
  await conversation.close();
  forks.next({ ...fork, id: 'f3' });
  expect(forks.observed).toBe(false);
});

it('switches to another session and shows its transcript', async () => {
  await conversation.ready();
  const first = latest();
  first.emit({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'old' },
  });
  const seen = firstValueFrom(conversation.changes.pipe(take(3), toArray()));
  const link = vi.fn<() => Promise<void>>(async () => {
    expect(host.close).toHaveBeenCalledExactlyOnceWith(first);
  });
  await conversation.switchTo(link);
  expect(link).toHaveBeenCalledOnce();
  expect((await seen).map(({ status }) => status.state)).toEqual([
    'idle',
    'starting',
    'starting',
  ]);
  expect(conversation.state.session?.id).toBe('s2');
  expect(conversation.state.messages).toEqual([]);
  first.emit({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'late' },
  });
  expect(conversation.state.messages).toEqual([]);
  expect(await conversation.ready()).toBe(latest());
});

it('closes the session it opened and nothing else', async () => {
  await conversation.close();
  expect(host.close).not.toHaveBeenCalled();
  const opened = new Conversation('c2', host);
  await opened.ready();
  const session = latest();
  const changes = firstValueFrom(opened.changes.pipe(toArray()));
  await opened.close();
  expect(host.close).toHaveBeenCalledExactlyOnceWith(session);
  expect((await changes).length).toBeGreaterThan(0);
  host.open.mockRejectedValueOnce(new Error('no agent'));
  const failed = new Conversation('c3', host);
  await expect(failed.ready()).rejects.toThrow('no agent');
  await failed.close();
  expect(host.close).toHaveBeenCalledOnce();
});

it('shows no settings while the catalog is unknown', async () => {
  host.catalog.mockResolvedValueOnce(null);
  await conversation.ready();
  const session = latest();
  session.configOptions.next([
    {
      id: 'model',
      name: 'Model',
      type: 'select',
      currentValue: 'opus',
      options: [],
    },
  ]);
  await flushed();
  expect(conversation.state.settings).toBeNull();
});
