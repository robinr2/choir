import type { CompactionStatus } from '@agentclientprotocol/sdk';

export type Sender = { id: string; name: string };

export type TurnMark = {
  voice?: true;
  aloud?: true;
  from?: Sender;
  text?: string;
  heard?: string;
};

type TextPart = { type: 'text'; text: string };

type ImagePart = { type: 'image'; image: string };

type ReasoningPart = { type: 'reasoning'; text: string };

export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type ApprovalOption = {
  id: string;
  kind: 'allow-once' | 'allow-always' | 'reject-once' | 'reject-always';
  label: string;
};

export type Approval = {
  id: string;
  prompt?: string;
  options: ApprovalOption[];
  approved?: boolean;
  optionId?: string;
  resolution?: 'cancelled';
};

export type QuestionItem = {
  id: string;
  header: string;
  prompt: string;
  options: { id: string; label: string; description?: string }[];
  multiple: boolean;
  freeform: string | null;
};

export type Answers = Record<string, string | string[]>;

export type Question = {
  id: string;
  questions: QuestionItem[];
  answers?: Answers;
  resolution?: 'declined' | 'cancelled';
};

export type ToolCallPart = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  kind: string;
  args: unknown;
  result?: unknown;
  isError?: boolean;
  status: ToolStatus;
  diffs: { path: string; oldText: string | null; newText: string }[];
  locations: { path: string; line?: number }[];
  timing: { startedAt: number; completedAt?: number };
  approval?: Approval;
  question?: Question;
  messages?: TranscriptMessage[];
};

export type ElicitationField = {
  name: string;
  label: string;
  kind: 'text' | 'choice' | 'toggle' | 'number';
  options?: string[];
  required: boolean;
};

type ElicitationState = 'request' | 'accepted' | 'declined' | 'cancelled';

export type ElicitationPart = {
  type: 'elicitation';
  id: string;
  server: string | null;
  message: string;
  mode: 'form' | 'url';
  url?: string;
  fields: ElicitationField[];
  state: ElicitationState;
};

export type CompactionPart = {
  type: 'compaction';
  id: string;
  status: CompactionStatus;
  summary: string;
};

export type TranscriptPart =
  | TextPart
  | ImagePart
  | ReasoningPart
  | ToolCallPart
  | ElicitationPart
  | CompactionPart;

export type TranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: TranscriptPart[];
  steered?: true;
  spoken?: true;
  heard?: string;
  from?: Sender;
};
