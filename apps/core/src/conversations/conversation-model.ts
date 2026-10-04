import { current, MODEL } from '../agent/agent-catalog.js';
import { CHOIR_COMMANDS } from './choir-commands.js';
import type {
  ConversationModel,
  ConversationState,
  Settings,
  StatusState,
} from './conversation-state.js';
import { NO_DETAILS } from './session-details.js';
import { withMarks } from './transcript-marks.js';

export function newModel(at: number): ConversationModel {
  return {
    messages: [],
    details: NO_DETAILS,
    session: null,
    status: { state: 'starting', since: at },
    queue: [],
    options: [],
    catalog: null,
    forks: [],
    marks: new Map(),
  };
}

export function withStatus(
  model: ConversationModel,
  state: StatusState,
  at: number,
): ConversationModel {
  if (model.status.state === state) return model;
  return { ...model, status: { state, since: at } };
}

function settingsOf({ options, catalog }: ConversationModel): Settings | null {
  const model = current(options, MODEL);
  if (!catalog || model === null) return null;
  const { models, modes, defaults } = catalog;
  const mode = current(options, 'mode') ?? defaults.mode;
  return { model, effort: current(options, 'effort'), mode, models, modes };
}

export function stateOf(model: ConversationModel): ConversationState {
  const { messages, details, session, status, queue, forks, marks } = model;
  return {
    messages: withMarks(messages, marks),
    session: session && { ...session, title: details.title },
    status,
    queue,
    settings: settingsOf(model),
    usage: details.usage,
    commands: [...details.commands, ...CHOIR_COMMANDS],
    plan: details.plan,
    forks,
  };
}

export function statusState({
  open,
  waiting,
  busy,
  failed,
}: {
  open: boolean;
  waiting: boolean;
  busy: boolean;
  failed: boolean;
}): StatusState {
  if (!open) return 'starting';
  if (waiting) return 'waiting';
  if (busy) return 'working';
  return failed ? 'failed' : 'idle';
}

export function withSession(
  model: ConversationModel,
  { id, cwd }: { id: string; cwd: string },
  marks: ConversationModel['marks'],
): ConversationModel {
  return {
    ...model,
    messages: [],
    details: NO_DETAILS,
    session: { id, cwd },
    marks,
  };
}
