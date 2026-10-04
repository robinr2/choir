import { isToolCall, toolCallPart } from './tool-call-part.js';
import { upsertPart } from './session-messages.js';
import type { ToolCallPart, TranscriptMessage } from './transcript.js';

type Messages = TranscriptMessage[];

type Spawned = {
  subagentSessionId: string;
  name: string;
  task: string;
};

type StateUpdate = { subagentSessionId: string; state: string };

function lastText(messages: Messages = []): string | undefined {
  const texts = messages.flatMap(({ parts }) =>
    parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])),
  );
  return texts.at(-1);
}

function ended(part: ToolCallPart, state: string, at: number): ToolCallPart {
  const failed = state !== 'completed';
  const result = lastText(part.messages);
  return {
    ...part,
    status: failed ? 'failed' : 'completed',
    isError: failed,
    timing: { ...part.timing, completedAt: at },
    ...(result !== undefined && { result }),
  };
}

export function withSpawned(
  messages: Messages,
  { subagentSessionId, name, task }: Spawned,
  at: number,
): Messages {
  return upsertPart(
    messages,
    isToolCall(subagentSessionId),
    (part) => part,
    () => ({
      ...toolCallPart(subagentSessionId, at),
      toolName: 'Agent',
      kind: 'think',
      args: { description: name, prompt: task },
      status: 'in_progress',
      messages: [],
    }),
  );
}

export function withSubagentState(
  messages: Messages,
  { subagentSessionId, state }: StateUpdate,
  at: number,
): Messages {
  return upsertPart(
    messages,
    isToolCall(subagentSessionId),
    (part) => ended(part, state, at),
    () => undefined,
  );
}

export function withinSubagent(
  messages: Messages,
  sessionId: string,
  change: (messages: Messages) => Messages,
): Messages {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== 'tool-call' || !part.messages) return part;
      const nested =
        part.toolCallId === sessionId
          ? change(part.messages)
          : withinSubagent(part.messages, sessionId, change);
      return { ...part, messages: nested };
    }),
  }));
}

export function subagentsRunning(messages: Messages): boolean {
  return messages.some(({ parts }) =>
    parts.some(
      (part) =>
        part.type === 'tool-call' &&
        part.messages !== undefined &&
        part.status === 'in_progress',
    ),
  );
}
