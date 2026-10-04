import type { SessionUpdate } from '@agentclientprotocol/sdk';

export type Command = {
  name: string;
  description: string;
  hint: string | null;
};

type PlanItem = {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
};

export type Usage = { used: number; size: number; cost: number | null };

export type SessionDetails = {
  title: string | null;
  usage: Usage | null;
  commands: Command[];
  plan: PlanItem[];
};

type Kind = SessionUpdate['sessionUpdate'];

type Updates = { [K in Kind]: Extract<SessionUpdate, { sessionUpdate: K }> };

type Reducers = {
  [K in Kind]?: (details: SessionDetails, update: Updates[K]) => SessionDetails;
};

export const NO_DETAILS: SessionDetails = {
  title: null,
  usage: null,
  commands: [],
  plan: [],
};

const REDUCERS: Reducers = {
  usage_update: (details, { used, size, cost }) => ({
    ...details,
    usage: { used, size, cost: cost?.amount ?? details.usage?.cost ?? null },
  }),
  available_commands_update: (details, { availableCommands }) => ({
    ...details,
    commands: availableCommands.map(({ name, description, input }) => ({
      name,
      description,
      hint: input?.hint ?? null,
    })),
  }),
  plan: (details, { entries }) => ({
    ...details,
    plan: entries.map(({ content, status }) => ({ content, status })),
  }),
  session_info_update: (details, { title }) =>
    title ? { ...details, title } : details,
};

export function withDetails(
  details: SessionDetails,
  update: SessionUpdate,
): SessionDetails {
  return reduced(details, update.sessionUpdate, update);
}

function reduced<K extends Kind>(
  details: SessionDetails,
  kind: K,
  update: Updates[K],
): SessionDetails {
  const reducer = REDUCERS[kind];
  return reducer ? reducer(details, update) : details;
}
