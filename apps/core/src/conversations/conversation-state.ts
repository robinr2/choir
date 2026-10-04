import type { SessionConfigOption } from '@agentclientprotocol/sdk';
import type {
  AgentCatalog,
  CatalogMode,
  CatalogModel,
} from '../agent/agent-catalog.js';
import type { Command, SessionDetails, Usage } from './session-details.js';
import type { TranscriptMessage, TurnMark } from './transcript.js';

export type StatusState =
  'starting' | 'idle' | 'working' | 'waiting' | 'failed';

type Status = { state: StatusState; since: number };

type QueueItem = { id: string; text: string; images: number };

export type Settings = {
  model: string;
  effort: string | null;
  mode: string;
  models: CatalogModel[];
  modes: CatalogMode[];
};

export type Fork = {
  id: string;
  sessionId: string;
  title: string;
  state: 'running' | 'ready' | 'failed';
  startedAt: number;
  endedAt: number | null;
};

export type ConversationState = {
  messages: TranscriptMessage[];
  session: { id: string; title: string | null; cwd: string } | null;
  status: Status;
  queue: QueueItem[];
  settings: Settings | null;
  usage: Usage | null;
  commands: Command[];
  plan: SessionDetails['plan'];
  forks: Fork[];
};

export type ConversationModel = {
  messages: TranscriptMessage[];
  details: SessionDetails;
  session: { id: string; cwd: string } | null;
  status: Status;
  queue: QueueItem[];
  options: SessionConfigOption[];
  catalog: AgentCatalog | null;
  forks: Fork[];
  marks: ReadonlyMap<string, TurnMark>;
};

export type ModelStore = {
  readonly current: ConversationModel;
  change(update: (model: ConversationModel) => ConversationModel): void;
};
