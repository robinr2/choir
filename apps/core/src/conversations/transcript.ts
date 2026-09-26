import type { AcpRuntimeEvent, AcpSessionRecord } from 'acpx/runtime';

type TextPart = { type: 'text'; text: string };

type ToolCallPart = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  isError?: boolean;
};

export type TranscriptPart = TextPart | ToolCallPart;

export type TranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: TranscriptPart[];
};

type SessionMessage = AcpSessionRecord['messages'][number];
type UserMessage = Extract<SessionMessage, { User: unknown }>['User'];
type AgentMessage = Extract<SessionMessage, { Agent: unknown }>['Agent'];
type AgentContent = AgentMessage['content'][number];

function userParts({ content }: UserMessage): TranscriptPart[] {
  const text = content
    .map((part) => ('Text' in part ? part.Text : ''))
    .join('');
  return [{ type: 'text', text }];
}

function agentPart(
  content: AgentContent,
  results: AgentMessage['tool_results'],
): TranscriptPart[] {
  if ('Text' in content) return [{ type: 'text', text: content.Text }];
  if (!('ToolUse' in content)) return [];
  const { id, name, input } = content.ToolUse;
  const result = results[id];
  return [
    {
      type: 'tool-call',
      toolCallId: id,
      toolName: name,
      args: input,
      result: result?.output,
      isError: result?.is_error,
    },
  ];
}

function messageOf(message: SessionMessage, id: string): TranscriptMessage[] {
  if (message === 'Resume') return [];
  if ('User' in message) {
    return [{ id, role: 'user', parts: userParts(message.User) }];
  }
  const { content, tool_results } = message.Agent;
  const parts = content.flatMap((part) => agentPart(part, tool_results));
  return [{ id, role: 'assistant', parts }];
}

export function transcriptOf(
  record: Pick<AcpSessionRecord, 'messages'>,
): TranscriptMessage[] {
  return record.messages.flatMap((message, index) =>
    messageOf(message, `m${index}`),
  );
}

function withText(parts: TranscriptPart[], text: string): TranscriptPart[] {
  const last = parts.at(-1);
  if (last?.type !== 'text') return [...parts, { type: 'text', text }];
  return [...parts.slice(0, -1), { type: 'text', text: last.text + text }];
}

type ToolCallEvent = Extract<AcpRuntimeEvent, { type: 'tool_call' }>;

function definedOnly(values: Partial<ToolCallPart>): Partial<ToolCallPart> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function failed(status: string | undefined): boolean | undefined {
  return status === undefined ? undefined : status === 'failed';
}

function updated(part: ToolCallPart, event: ToolCallEvent): ToolCallPart {
  return {
    ...part,
    ...definedOnly({
      toolName: event.title ?? event.kind,
      args: event.rawInput,
      result: event.rawOutput,
      isError: failed(event.status),
    }),
  };
}

function isToolCall(id: string) {
  return (part: TranscriptPart): part is ToolCallPart =>
    part.type === 'tool-call' && part.toolCallId === id;
}

function withToolCall(
  parts: TranscriptPart[],
  event: ToolCallEvent,
): TranscriptPart[] {
  const toolCallId = event.toolCallId ?? '';
  const index = parts.findIndex(isToolCall(toolCallId));
  const previous = parts.find(isToolCall(toolCallId)) ?? {
    type: 'tool-call',
    toolCallId,
    toolName: 'tool_call',
    args: undefined,
  };
  const part = updated(previous, event);
  if (index < 0) return [...parts, part];
  return parts.with(index, part);
}

export function answerText(event: AcpRuntimeEvent): string | undefined {
  if (event.type !== 'text_delta' || event.stream === 'thought') {
    return undefined;
  }
  return event.text;
}

export function withEvent(
  parts: TranscriptPart[],
  event: AcpRuntimeEvent,
): TranscriptPart[] {
  const text = answerText(event);
  if (text !== undefined) return withText(parts, text);
  if (event.type === 'tool_call') return withToolCall(parts, event);
  return parts;
}
