import type { Interaction } from '../agent/interactions.js';
import { FakeSession } from '../test/fake-session.js';
import { newModel, stateOf } from './conversation-model.js';
import { ConversationView } from './conversation-view.js';
import { type FeedHooks, SessionFeed } from './session-feed.js';

let session: FakeSession;
let view: ConversationView;
let hooks: { [K in keyof FeedHooks]: ReturnType<typeof vi.fn<FeedHooks[K]>> };
let feed: SessionFeed;

const PERMISSION: Interaction = {
  id: 'i1',
  kind: 'permission',
  request: {
    sessionId: 's1',
    toolCall: { toolCallId: 't1', title: 'ls' },
    options: [{ optionId: 'yes', name: 'Yes', kind: 'allow_once' }],
  },
};

beforeEach(() => {
  session = new FakeSession();
  view = new ConversationView(newModel(0), stateOf);
  hooks = {
    usage: vi.fn<FeedHooks['usage']>(),
    changed: vi.fn<FeedHooks['changed']>(),
    held: vi.fn<FeedHooks['held']>(),
  };
  feed = new SessionFeed(session, view, hooks);
});

afterEach(() => {
  feed.close();
});

it('shows the updates of the session and passes on its usage', () => {
  const usage = { sessionUpdate: 'usage_update', used: 1, size: 2 } as const;
  session.emit({ sessionUpdate: 'session_info_update', title: 'Notes' });
  session.emit(usage);
  session.emit({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'Hi' },
  });
  session.emit({
    sessionUpdate: 'subagent_spawned',
    subagentSessionId: 'a',
    name: 'x',
    task: 'y',
  });
  session.emit(usage, 'a');
  expect(view.state.session).toBeNull();
  expect(view.current.details.title).toBe('Notes');
  expect(view.state.usage).toEqual({ used: 1, size: 2, cost: null });
  expect(view.state.messages[0]?.parts).toHaveLength(2);
  expect(hooks.usage).toHaveBeenCalledTimes(4);
  expect(hooks.usage).toHaveBeenLastCalledWith(usage);
  expect(hooks.held).not.toHaveBeenCalled();
  session.emit({ ...usage, cost: { amount: 1, currency: 'USD' } });
  expect(hooks.held).toHaveBeenCalledOnce();
});

it('follows the config options of the session', () => {
  const options = [
    { id: 'fast', name: 'Fast', type: 'boolean', currentValue: false } as const,
  ];
  session.configOptions.next(options);
  expect(view.current.options).toBe(options);
});

it('shows what the agent asks, waits for it and tells answered from unknown questions', () => {
  session.interactions.next({ type: 'requested', interaction: PERMISSION });
  expect(feed.pending).toEqual(new Set(['i1']));
  expect(view.state.messages[0]?.parts[0]).toMatchObject({
    approval: { id: 'i1' },
  });
  expect(hooks.changed).toHaveBeenCalledOnce();
  expect(feed.respond('i1', { optionId: 'yes' })).toBe('answered');
  expect(session.respond).toHaveBeenCalledExactlyOnceWith('i1', {
    optionId: 'yes',
  });
  session.interactions.next({
    type: 'settled',
    id: 'i1',
    answer: { optionId: 'yes' },
  });
  expect(feed.pending).toEqual(new Set());
  expect(view.state.messages[0]?.parts[0]).toMatchObject({
    approval: { approved: true },
  });
  session.respond.mockReturnValue('unknown');
  expect(feed.respond('i1', { optionId: 'yes' })).toBe('answered-before');
  expect(feed.respond('i2', { optionId: 'yes' })).toBe('unknown');
  session.respond.mockReturnValue('unfit');
  expect(feed.respond('i1', { optionId: 'no' })).toBe('unfit');
  session.interactions.next({ type: 'completed', elicitationId: 'e1' });
  expect(hooks.changed).toHaveBeenCalledTimes(3);
});

it('stops following the session once closed', () => {
  feed.close();
  session.emit({ sessionUpdate: 'session_info_update', title: 'Late' });
  session.interactions.next({ type: 'requested', interaction: PERMISSION });
  session.configOptions.next([]);
  expect(view.current).toEqual(newModel(0));
});
