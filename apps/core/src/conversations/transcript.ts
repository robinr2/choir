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

export type Sender = { id: string; name: string };

export type TurnMark = {
  voice?: true;
  aloud?: true;
  from?: Sender;
  text?: string;
  heard?: string;
};

export type TranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: TranscriptPart[];
  spoken?: true;
  heard?: string;
  from?: Sender;
};

type SessionMessage = AcpSessionRecord['messages'][number];
type UserMessage = Extract<SessionMessage, { User: unknown }>['User'];
type AgentMessage = Extract<SessionMessage, { Agent: unknown }>['Agent'];
type AgentContent = AgentMessage['content'][number];

function userText({ content }: UserMessage): string {
  return content.map((part) => ('Text' in part ? part.Text : '')).join('');
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

function userMarks(mark: TurnMark): Partial<TranscriptMessage> {
  return mark.from ? { from: mark.from } : {};
}

function replyMarks(mark: TurnMark): Partial<TranscriptMessage> {
  if (!mark.aloud) return {};
  const { heard } = mark;
  return { spoken: true, ...(heard !== undefined && { heard }) };
}

function messageOf(
  message: SessionMessage,
  id: string,
  mark: TurnMark,
): TranscriptMessage[] {
  if (message === 'Resume') return [];
  if ('User' in message) {
    const text = mark.text ?? userText(message.User);
    const parts = [{ type: 'text' as const, text }];
    return [{ id, role: 'user', parts, ...userMarks(mark) }];
  }
  const { content, tool_results } = message.Agent;
  const parts = content.flatMap((part) => agentPart(part, tool_results));
  return [{ id, role: 'assistant', parts, ...replyMarks(mark) }];
}

export function liveMessages(
  { prompt, mark }: { prompt: string; mark: TurnMark },
  parts: TranscriptPart[],
  index: number,
): TranscriptMessage[] {
  return [
    {
      id: `m${index}`,
      role: 'user',
      parts: [{ type: 'text', text: mark.text ?? prompt }],
      ...userMarks(mark),
    },
    { id: `m${index + 1}`, role: 'assistant', parts, ...replyMarks(mark) },
  ];
}

function promptOf(message: SessionMessage): string | undefined {
  if (message === 'Resume' || !('User' in message)) return undefined;
  return userText(message.User);
}

export function transcriptOf(
  record: Pick<AcpSessionRecord, 'messages'>,
  marks: ReadonlyMap<string, TurnMark>,
): TranscriptMessage[] {
  let mark: TurnMark = {};
  return record.messages.flatMap((message, index) => {
    const prompt = promptOf(message);
    if (prompt !== undefined) mark = marks.get(prompt) ?? {};
    return messageOf(message, `m${index}`, mark);
  });
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
