import type { SessionUpdate } from '@agentclientprotocol/sdk';

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

export type HistoryEntry =
  | { role: 'user'; text: string; messageId?: string | null }
  | { role: 'assistant'; parts: TranscriptPart[] };

type ToolCallUpdate = Extract<
  SessionUpdate,
  { sessionUpdate: 'tool_call' | 'tool_call_update' }
>;

type UserChunk = Extract<
  SessionUpdate,
  { sessionUpdate: 'user_message_chunk' }
>;

function userMarks(mark: TurnMark): Partial<TranscriptMessage> {
  return mark.from ? { from: mark.from } : {};
}

function replyMarks(mark: TurnMark): Partial<TranscriptMessage> {
  if (!mark.aloud) return {};
  const { heard } = mark;
  return { spoken: true, ...(heard !== undefined && { heard }) };
}

function userMessage(text: string, id: string, mark: TurnMark) {
  const parts = [{ type: 'text' as const, text: mark.text ?? text }];
  return { id, role: 'user' as const, parts, ...userMarks(mark) };
}

export function liveMessages(
  { prompt, mark }: { prompt: string; mark: TurnMark },
  parts: TranscriptPart[],
  index: number,
): TranscriptMessage[] {
  return [
    userMessage(prompt, `m${index}`, mark),
    { id: `m${index + 1}`, role: 'assistant', parts, ...replyMarks(mark) },
  ];
}

export function transcriptOf(
  entries: HistoryEntry[],
  marks: ReadonlyMap<string, TurnMark>,
): TranscriptMessage[] {
  let mark: TurnMark = {};
  return entries.map((entry, index) => {
    if (entry.role === 'assistant') {
      const { parts } = entry;
      return { id: `m${index}`, role: 'assistant', parts, ...replyMarks(mark) };
    }
    mark = marks.get(entry.text) ?? {};
    return userMessage(entry.text, `m${index}`, mark);
  });
}

function continues(
  last: HistoryEntry | undefined,
  { messageId }: UserChunk,
): last is Extract<HistoryEntry, { role: 'user' }> {
  if (last?.role !== 'user') return false;
  return !messageId || !last.messageId || messageId === last.messageId;
}

function withUserChunk(
  entries: HistoryEntry[],
  chunk: UserChunk,
): HistoryEntry[] {
  const text = chunk.content.type === 'text' ? chunk.content.text : '';
  const last = entries.at(-1);
  if (!continues(last, chunk)) {
    return [...entries, { role: 'user', text, messageId: chunk.messageId }];
  }
  return [...entries.slice(0, -1), { ...last, text: last.text + text }];
}

const NO_PARTS: TranscriptPart[] = [];

function lastReply(entries: HistoryEntry[]): TranscriptPart[] | undefined {
  const last = entries.at(-1);
  return last?.role === 'assistant' ? last.parts : undefined;
}

function withReplyUpdate(
  entries: HistoryEntry[],
  update: SessionUpdate,
): HistoryEntry[] {
  const previous = lastReply(entries) ?? NO_PARTS;
  const parts = withEvent(previous, update);
  if (parts === previous) return entries;
  const kept = previous === NO_PARTS ? entries : entries.slice(0, -1);
  return [...kept, { role: 'assistant', parts }];
}

export function historyOf(updates: SessionUpdate[]): HistoryEntry[] {
  return updates.reduce<HistoryEntry[]>(
    (entries, update) =>
      update.sessionUpdate === 'user_message_chunk'
        ? withUserChunk(entries, update)
        : withReplyUpdate(entries, update),
    [],
  );
}

function withText(parts: TranscriptPart[], text: string): TranscriptPart[] {
  const last = parts.at(-1);
  if (last?.type !== 'text') return [...parts, { type: 'text', text }];
  return [...parts.slice(0, -1), { type: 'text', text: last.text + text }];
}

function definedOnly(values: Partial<ToolCallPart>): Partial<ToolCallPart> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function failed(status: string | null | undefined): boolean | undefined {
  return status ? status === 'failed' : undefined;
}

function updated(part: ToolCallPart, update: ToolCallUpdate): ToolCallPart {
  return {
    ...part,
    ...definedOnly({
      toolName: update.title ?? update.kind ?? undefined,
      args: update.rawInput ?? undefined,
      result: update.rawOutput ?? undefined,
      isError: failed(update.status),
    }),
  };
}

function isToolCall(id: string) {
  return (part: TranscriptPart): part is ToolCallPart =>
    part.type === 'tool-call' && part.toolCallId === id;
}

function withToolCall(
  parts: TranscriptPart[],
  update: ToolCallUpdate,
): TranscriptPart[] {
  const { toolCallId } = update;
  const index = parts.findIndex(isToolCall(toolCallId));
  const previous = parts.find(isToolCall(toolCallId)) ?? {
    type: 'tool-call',
    toolCallId,
    toolName: 'tool_call',
    args: undefined,
  };
  const part = updated(previous, update);
  if (index < 0) return [...parts, part];
  return parts.with(index, part);
}

export function answerText(update: SessionUpdate): string | undefined {
  if (update.sessionUpdate !== 'agent_message_chunk') return undefined;
  return update.content.type === 'text' ? update.content.text : undefined;
}

export function withEvent(
  parts: TranscriptPart[],
  update: SessionUpdate,
): TranscriptPart[] {
  const text = answerText(update);
  if (text !== undefined) return withText(parts, text);
  if (
    update.sessionUpdate === 'tool_call' ||
    update.sessionUpdate === 'tool_call_update'
  ) {
    return withToolCall(parts, update);
  }
  return parts;
}
