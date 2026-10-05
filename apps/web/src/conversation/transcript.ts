import type { ThreadMessageLike } from '@assistant-ui/react';

type TextPart = { type: 'text'; text: string };

type ImagePart = { type: 'image'; image: string };

type ReasoningPart = { type: 'reasoning'; text: string };

type ApprovalOption = {
  id: string;
  kind: 'allow-once' | 'allow-always' | 'reject-once' | 'reject-always';
  label: string;
};

type Approval = {
  id: string;
  prompt?: string;
  options: ApprovalOption[];
  approved?: boolean;
  optionId?: string;
  resolution?: 'cancelled';
};

type QuestionItem = {
  id: string;
  header: string;
  prompt: string;
  options: { id: string; label: string; description?: string }[];
  multiple: boolean;
  freeform: string | null;
};

type Question = {
  id: string;
  questions: QuestionItem[];
  answers?: Record<string, string | string[]>;
  resolution?: 'declined' | 'cancelled';
};

type ToolCallPart = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  kind: string;
  args: unknown;
  result?: unknown;
  isError?: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  diffs: { path: string; oldText: string | null; newText: string }[];
  locations: { path: string; line?: number }[];
  timing: { startedAt: number; completedAt?: number };
  approval?: Approval;
  question?: Question;
  messages?: TranscriptMessage[];
};

type ElicitationPart = {
  type: 'elicitation';
  id: string;
  server: string | null;
  message: string;
  mode: 'form' | 'url';
  url?: string;
  fields: {
    name: string;
    label: string;
    kind: 'text' | 'choice' | 'toggle' | 'number';
    options?: string[];
    required: boolean;
  }[];
  state: 'request' | 'accepted' | 'declined' | 'cancelled';
};

type CompactionPart = {
  type: 'compaction';
  id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  summary: string;
};

type TranscriptPart =
  | TextPart
  | ImagePart
  | ReasoningPart
  | ToolCallPart
  | ElicitationPart
  | CompactionPart;

export type Sender = { id: string; name: string };

export type TranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: TranscriptPart[];
  steered?: true;
  spoken?: true;
  heard?: string;
  from?: Sender;
};

export type ShownMessage = TranscriptMessage & { spokenUpTo?: number };

type ThreadPart = Exclude<ThreadMessageLike['content'], string>[number];

const NO_SENDER: Sender = { id: '', name: '' };

function isSender(value: unknown): value is Sender {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

export function senderIn(custom: Record<string, unknown>): Sender {
  return isSender(custom.from) ? custom.from : NO_SENDER;
}

export function isSpokenIn(custom: Record<string, unknown>): boolean {
  return typeof custom.spokenUpTo === 'number';
}

function isText(part: { type: string; text?: string }): part is TextPart {
  return part.type === 'text';
}

export function textBefore(
  parts: readonly { type: string; text?: string }[],
  query: object | null,
): number {
  const index = query !== null && 'index' in query ? Number(query.index) : 0;
  return parts
    .slice(0, index)
    .filter(isText)
    .reduce((length, { text }) => length + text.length, 0);
}

export function userTurnsIn(messages: readonly TranscriptMessage[]): number {
  return messages.filter(({ role }) => role === 'user').length;
}

export function spokenTextsOf({ parts }: TranscriptMessage): string[] {
  return parts.flatMap((part) =>
    part.type === 'text' && part.text.trim() ? [part.text] : [],
  );
}

function threadParts(part: TranscriptPart): ThreadPart[] {
  if (part.type === 'elicitation' || part.type === 'compaction') return [];
  if (part.type !== 'tool-call') return [part];
  return [
    {
      type: 'tool-call',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      argsText: JSON.stringify(part.args ?? {}),
      result: part.result,
      isError: part.isError,
    },
  ];
}

export function threadMessageOf(message: ShownMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.parts.flatMap(threadParts),
    metadata: {
      custom: {
        ...(message.spokenUpTo !== undefined && {
          spokenUpTo: message.spokenUpTo,
        }),
        ...(message.from && { from: message.from }),
      },
    },
  };
}
