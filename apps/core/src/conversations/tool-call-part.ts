import type { ToolCallContent, ToolCallUpdate } from '@agentclientprotocol/sdk';
import type { ToolCallPart, ToolStatus, TranscriptPart } from './transcript.js';

type Step = (
  part: ToolCallPart,
  update: ToolCallUpdate,
  at: number,
) => ToolCallPart;

const FINISHED = new Set<ToolStatus>(['completed', 'failed']);

export function isToolCall(toolCallId: string) {
  return (part: TranscriptPart): part is ToolCallPart =>
    part.type === 'tool-call' && part.toolCallId === toolCallId;
}

export function toolCallPart(toolCallId: string, at: number): ToolCallPart {
  return {
    type: 'tool-call',
    toolCallId,
    toolName: 'tool',
    kind: 'other',
    args: undefined,
    status: 'pending',
    diffs: [],
    locations: [],
    timing: { startedAt: at },
  };
}

function textOf(content: ToolCallContent[]): string | undefined {
  const texts = content.flatMap((item) =>
    item.type === 'content' && item.content.type === 'text'
      ? [item.content.text]
      : [],
  );
  return texts.length > 0 ? texts.join('\n') : undefined;
}

const named: Step = (part, { title }) =>
  title ? { ...part, toolName: title } : part;

const kinded: Step = (part, { kind }) => (kind ? { ...part, kind } : part);

const argued: Step = (part, { rawInput }) =>
  rawInput === undefined ? part : { ...part, args: rawInput };

const diffed: Step = (part, { content }) => {
  const diffs = (content ?? []).flatMap((item) =>
    item.type === 'diff'
      ? [
          {
            path: item.path,
            oldText: item.oldText ?? null,
            newText: item.newText,
          },
        ]
      : [],
  );
  return diffs.length > 0 ? { ...part, diffs } : part;
};

const resulted: Step = (part, { content, rawOutput }) => {
  const result = rawOutput ?? textOf(content ?? []);
  return result === undefined ? part : { ...part, result };
};

const located: Step = (part, { locations }) => {
  if (!locations) return part;
  return {
    ...part,
    locations: locations.map(({ path, line }) =>
      typeof line === 'number' ? { path, line } : { path },
    ),
  };
};

const progressed: Step = (part, { status }, at) => {
  if (!status) return part;
  if (!FINISHED.has(status)) return { ...part, status };
  const completedAt = part.timing.completedAt ?? at;
  const isError = status === 'failed';
  return { ...part, status, isError, timing: { ...part.timing, completedAt } };
};

const STEPS = [named, kinded, argued, diffed, resulted, located, progressed];

export function withToolCallUpdate(
  part: ToolCallPart,
  update: ToolCallUpdate,
  at: number,
): ToolCallPart {
  return STEPS.reduce((current, step) => step(current, update, at), part);
}
