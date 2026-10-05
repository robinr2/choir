import { EMPTY, lastValueFrom, Observable, of, toArray } from 'rxjs';
import type { SessionListing } from '../agent/agent-catalog.js';
import { ConversationCommandsService } from './conversation-commands.service.js';
import type { ConversationState } from './conversation-state.js';
import type { Conversations } from './conversations.port.js';

type Used =
  | 'addUserTurn'
  | 'submit'
  | 'session'
  | 'switchSession'
  | 'changes'
  | 'followFork';

const ANSWER = of('done');
const KIND = { early: false, voice: false };
const LISTING: SessionListing = {
  sessionId: 's9',
  cwd: '/elsewhere',
  title: null,
  updatedAt: null,
};

let conversations: {
  [K in Used]: ReturnType<typeof vi.fn<Conversations[K]>>;
};
let host: {
  fork: ReturnType<typeof vi.fn<(id: string, cwd: string) => Promise<string>>>;
  sessions: ReturnType<typeof vi.fn<() => Promise<SessionListing[]>>>;
  link: ReturnType<
    typeof vi.fn<(id: string, sessionId: string, cwd: string) => Promise<void>>
  >;
};
let commands: ConversationCommandsService;

async function run(text: string): Promise<string[]> {
  const answer = await commands.addUserTurn('c1', { text }, KIND);
  return lastValueFrom(answer.pipe(toArray()));
}

beforeEach(() => {
  conversations = {
    addUserTurn: vi.fn<Conversations['addUserTurn']>(async () => ANSWER),
    submit: vi.fn<Conversations['submit']>(async () => ANSWER),
    session: vi.fn<Conversations['session']>(async () => ({
      id: 's1',
      cwd: '/work',
    })),
    switchSession: vi.fn<Conversations['switchSession']>(async () => undefined),
    changes: vi.fn<Conversations['changes']>(
      () => new Observable<ConversationState>(),
    ),
    followFork: vi.fn<Conversations['followFork']>(),
  };
  host = {
    fork: vi.fn<(id: string, cwd: string) => Promise<string>>(async () => 's2'),
    sessions: vi.fn<() => Promise<SessionListing[]>>(async () => [LISTING]),
    link: vi.fn<(id: string, sessionId: string, cwd: string) => Promise<void>>(
      async () => undefined,
    ),
  };
  commands = new ConversationCommandsService(conversations, host);
});

it('passes on everything that is not a choir command', async () => {
  const images = [{ data: 'aGk=', mimeType: 'image/png' }];
  const answer = await commands.addUserTurn(
    'c1',
    { text: '/compact', images },
    KIND,
  );
  expect(answer).toBe(ANSWER);
  expect(conversations.addUserTurn).toHaveBeenCalledExactlyOnceWith(
    'c1',
    { text: '/compact', images },
    KIND,
  );
});

it('asks for a subtask in a background fork and shows what the user typed', async () => {
  expect(await run('/subtask write tests')).toEqual(['done']);
  expect(conversations.submit).toHaveBeenCalledExactlyOnceWith('c1', {
    prompt: expect.stringContaining('subagent_type "fork"'),
    words: expect.stringContaining('write tests'),
    early: false,
    mark: { text: '/subtask write tests' },
  });
  await expect(run('/subtask')).rejects.toThrow('Name the task of the subtask');
});

it('branches into a fork of the session and renames it when given a name', async () => {
  expect(await run('/branch')).toEqual([]);
  expect(host.fork).toHaveBeenCalledExactlyOnceWith('s1', '/work');
  expect(conversations.switchSession).toHaveBeenCalledExactlyOnceWith(
    'c1',
    's2',
    '/work',
  );
  expect(conversations.submit).not.toHaveBeenCalled();
  await run('/branch feature x');
  expect(conversations.submit).toHaveBeenCalledExactlyOnceWith('c1', {
    prompt: '/rename feature x',
    words: '/rename feature x',
    early: false,
    mark: {},
  });
});

it('forks into a background conversation it lists and prompts', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(42);
  expect(await run('/fork write tests')).toEqual([]);
  const [[forkId, sessionId, cwd] = []] = host.link.mock.calls;
  expect([sessionId, cwd]).toEqual(['s2', '/work']);
  expect(forkId).toMatch(/^[0-9a-f-]{36}$/);
  expect(conversations.changes).toHaveBeenCalledExactlyOnceWith(forkId);
  expect(conversations.submit).toHaveBeenCalledExactlyOnceWith(forkId, {
    prompt: 'write tests',
    words: 'write tests',
    early: false,
    mark: {},
  });
  const [[parent, forks] = []] = conversations.followFork.mock.calls;
  expect(parent).toBe('c1');
  conversations.changes.mockReturnValue(
    of({
      messages: [],
      session: null,
      status: { state: 'idle', since: 50 },
      queue: [],
      settings: null,
      usage: null,
      commands: [],
      plan: [],
      forks: [],
    }),
  );
  await run('/fork');
  const quiet = conversations.followFork.mock.calls[1]?.[1] ?? EMPTY;
  expect(forks).toBeInstanceOf(Observable);
  expect(await lastValueFrom(quiet.pipe(toArray()))).toEqual([
    {
      id: expect.any(String),
      sessionId: 's2',
      title: 'Fork',
      state: 'ready',
      startedAt: 42,
      endedAt: 50,
    },
  ]);
  expect(conversations.submit).toHaveBeenCalledOnce();
});

it('resumes a session that exists in its folder', async () => {
  await run('/resume s9');
  expect(conversations.switchSession).toHaveBeenCalledExactlyOnceWith(
    'c1',
    's9',
    '/elsewhere',
  );
  await expect(run('/resume')).rejects.toThrow('Name the session to resume');
  await expect(run('/resume s0')).rejects.toThrow('There is no session s0');
});
