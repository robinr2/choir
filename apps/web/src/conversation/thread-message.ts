import type {
  ThreadAssistantMessagePart,
  ThreadMessage,
  ThreadMessageLike,
  ThreadUserMessagePart,
  ToolCallMessagePart,
} from '@assistant-ui/react';
import type {
  Question,
  ShownMessage,
  ToolCallPart,
  TranscriptMessage,
  TranscriptPart,
} from './transcript';

export type ToolDetails = Pick<
  ToolCallPart,
  'kind' | 'status' | 'diffs' | 'locations' | 'question'
>;

type Args = ToolCallMessagePart['args'];

type UserPart = Extract<TranscriptPart, { type: 'text' | 'image' }>;

const CREATED = new Date(0);

const RUNNING = { type: 'running' } as const;

const COMPLETE = { type: 'complete', reason: 'unknown' } as const;

function isUserPart(part: TranscriptPart): part is UserPart {
  return part.type === 'text' || part.type === 'image';
}

function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function argsOf(args: unknown): Args {
  return isRecord(args) ? Object.fromEntries(Object.entries(args)) : {};
}

const NO_DETAILS: ToolDetails = {
  kind: 'other',
  status: 'completed',
  diffs: [],
  locations: [],
};

function isToolDetails(artifact: unknown): artifact is ToolDetails {
  return isRecord(artifact) && 'diffs' in artifact && 'locations' in artifact;
}

export function toolDetailsIn(artifact: unknown): ToolDetails {
  return isToolDetails(artifact) ? artifact : NO_DETAILS;
}

function isSettled({ status }: ToolCallPart): boolean {
  return status === 'completed' || status === 'failed';
}

function resultOf(part: ToolCallPart): unknown {
  return part.result ?? (isSettled(part) ? null : undefined);
}

function isOpen(question?: Question): question is Question {
  return question !== undefined && !question.answers && !question.resolution;
}

function interruptOf({ question }: ToolCallPart) {
  return isOpen(question)
    ? { interrupt: { type: 'human' as const, payload: question } }
    : {};
}

function detailsOf(part: ToolCallPart): ToolDetails {
  const { kind, status, diffs, locations, question } = part;
  return { kind, status, diffs, locations, question };
}

function nestedOf(part: ToolCallPart, path: string) {
  if (!part.messages) return {};
  const prefix = `${path}${part.toolCallId}/`;
  return {
    messages: nestedMessagesOf(part.messages, prefix, !isSettled(part)),
  };
}

function toolCallOf(part: ToolCallPart, path: string): ToolCallMessagePart {
  return {
    type: 'tool-call',
    toolCallId: part.toolCallId,
    toolName: part.toolName,
    args: argsOf(part.args),
    argsText: JSON.stringify(part.args ?? {}),
    result: resultOf(part),
    isError: part.isError,
    timing: part.timing,
    artifact: detailsOf(part),
    ...(part.approval && { approval: part.approval }),
    ...interruptOf(part),
    ...nestedOf(part, path),
  };
}

function threadPartOf(
  part: TranscriptPart,
  path: string,
): ThreadAssistantMessagePart {
  if (part.type === 'tool-call') return toolCallOf(part, path);
  if (part.type === 'elicitation' || part.type === 'compaction') {
    return { type: 'data', name: part.type, data: part };
  }
  return part;
}

function threadPartsOf(
  parts: readonly TranscriptPart[],
  path: string,
): ThreadAssistantMessagePart[] {
  return parts.map((part) => threadPartOf(part, path));
}

function userPartsOf(
  parts: readonly TranscriptPart[],
): ThreadUserMessagePart[] {
  return parts.filter(isUserPart);
}

function nestedMessageOf(
  { id, role, parts }: TranscriptMessage,
  running: boolean,
): ThreadMessage {
  if (role === 'user') {
    const content = userPartsOf(parts);
    return {
      id,
      role,
      createdAt: CREATED,
      content,
      attachments: [],
      metadata: { custom: {} },
    };
  }
  return {
    id,
    role,
    createdAt: CREATED,
    content: threadPartsOf(parts, `${id}/`),
    status: running ? RUNNING : COMPLETE,
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
  };
}

function nestedMessagesOf(
  messages: readonly TranscriptMessage[],
  prefix: string,
  running: boolean,
): ThreadMessage[] {
  const last = messages.length - 1;
  return messages.map((message, index) =>
    nestedMessageOf(
      { ...message, id: `${prefix}${message.id}` },
      running && index === last,
    ),
  );
}

function customOf({ spokenUpTo, from, steered }: ShownMessage) {
  return {
    ...(spokenUpTo !== undefined && { spokenUpTo }),
    ...(from && { from }),
    ...(steered && { steered }),
  };
}

export function threadMessageOf(message: ShownMessage): ThreadMessageLike {
  const { id, role, parts } = message;
  return {
    id,
    role,
    content: role === 'user' ? userPartsOf(parts) : threadPartsOf(parts, ''),
    metadata: { custom: customOf(message) },
  };
}
