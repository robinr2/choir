import type { AppendMessage, ThreadMessageLike } from '@assistant-ui/react';

type TextPart = { type: 'text'; text: string };

type ToolCallPart = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  isError?: boolean;
};

export type TranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: (TextPart | ToolCallPart)[];
};

type ThreadPart = Exclude<ThreadMessageLike['content'], string>[number];

function threadPart(part: TextPart | ToolCallPart): ThreadPart {
  if (part.type === 'text') return part;
  return {
    type: 'tool-call',
    toolCallId: part.toolCallId,
    toolName: part.toolName,
    argsText: JSON.stringify(part.args ?? {}),
    result: part.result,
    isError: part.isError,
  };
}

export function threadMessageOf(message: TranscriptMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.parts.map(threadPart),
  };
}

export function textOf(message: Pick<AppendMessage, 'content'>): string {
  return message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}
