import type { SessionConfigOption } from '@agentclientprotocol/sdk';
import type { AgentCatalog } from '../agent/agent-catalog.js';
import { CHOIR_COMMANDS } from './choir-commands.js';
import {
  newModel,
  stateOf,
  statusState,
  withSession,
  withStatus,
} from './conversation-model.js';
import { NO_DETAILS } from './session-details.js';

const CATALOG: AgentCatalog = {
  models: [{ value: 'opus', name: 'Opus', description: null, efforts: [] }],
  modes: [{ value: 'plan', name: 'Plan', description: null }],
  defaults: {
    cwd: '/w',
    model: 'opus',
    effort: null,
    mode: 'bypassPermissions',
  },
};

function select(id: string, currentValue: string): SessionConfigOption {
  return {
    id,
    name: id,
    type: 'select',
    currentValue,
    options: [{ value: currentValue, name: currentValue }],
  };
}

it('starts with nothing known', () => {
  const model = newModel(5);
  expect(stateOf(model)).toEqual({
    messages: [],
    session: null,
    status: { state: 'starting', since: 5 },
    queue: [],
    settings: null,
    usage: null,
    commands: CHOIR_COMMANDS,
    plan: [],
    forks: [],
  });
});

it('shows the session, settings, usage, commands and marks of the model', () => {
  const marks = new Map([['hi', { text: 'shown' }]]);
  const model = {
    ...withSession(newModel(1), { id: 's1', cwd: '/w' }, marks),
    messages: [
      {
        id: 'm0',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'hi' }],
      },
    ],
    details: {
      title: 'Notes',
      usage: { used: 1, size: 2, cost: null },
      commands: [{ name: 'compact', description: 'Compact', hint: null }],
      plan: [{ content: 'Read', status: 'pending' as const }],
    },
    options: [
      select('mode', 'plan'),
      select('model', 'opus'),
      select('effort', 'high'),
    ],
    catalog: CATALOG,
  };
  const state = stateOf(model);
  expect(state.session).toEqual({ id: 's1', cwd: '/w', title: 'Notes' });
  expect(state.messages[0]?.parts).toEqual([{ type: 'text', text: 'shown' }]);
  expect(state.settings).toEqual({
    model: 'opus',
    effort: 'high',
    mode: 'plan',
    models: CATALOG.models,
    modes: CATALOG.modes,
  });
  expect(state.usage).toEqual({ used: 1, size: 2, cost: null });
  expect(state.commands.map(({ name }) => name)).toEqual([
    'compact',
    'branch',
    'fork',
    'subtask',
    'resume',
  ]);
  expect(state.plan).toEqual([{ content: 'Read', status: 'pending' }]);
  expect(
    stateOf({ ...model, options: [select('model', 'opus')] }).settings,
  ).toEqual({
    model: 'opus',
    effort: null,
    mode: 'bypassPermissions',
    models: CATALOG.models,
    modes: CATALOG.modes,
  });
  expect(stateOf({ ...model, options: [] }).settings).toBeNull();
  expect(stateOf({ ...model, catalog: null }).settings).toBeNull();
});

it('starts a session over with an empty transcript', () => {
  const used = {
    ...newModel(1),
    messages: [{ id: 'm0', role: 'user' as const, parts: [] }],
    details: { ...NO_DETAILS, title: 'Old' },
  };
  const marks = new Map();
  expect(withSession(used, { id: 's2', cwd: '/x' }, marks)).toEqual({
    ...used,
    messages: [],
    details: NO_DETAILS,
    session: { id: 's2', cwd: '/x' },
    marks,
  });
});

it('changes the status only when it changes and remembers since when', () => {
  const model = newModel(1);
  expect(withStatus(model, 'starting', 9)).toBe(model);
  expect(withStatus(model, 'idle', 9).status).toEqual({
    state: 'idle',
    since: 9,
  });
});

it('tells the state of a conversation', () => {
  const flags = { open: true, waiting: false, busy: false, failed: false };
  expect(statusState({ ...flags, open: false, waiting: true })).toBe(
    'starting',
  );
  expect(statusState({ ...flags, waiting: true, busy: true })).toBe('waiting');
  expect(statusState({ ...flags, busy: true, failed: true })).toBe('working');
  expect(statusState({ ...flags, failed: true })).toBe('failed');
  expect(statusState(flags)).toBe('idle');
});
