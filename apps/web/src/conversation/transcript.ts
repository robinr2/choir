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

export type Sender = { id: string; name: string };

export type TranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: (TextPart | ToolCallPart)[];
  voice?: true;
  spoken?: true;
  from?: Sender;
};

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
    metadata: {
      ...(message.voice && { modality: 'voice' }),
      custom: {
        ...(message.spoken && { spoken: true }),
        ...(message.from && { from: message.from }),
      },
    },
  };
}

export function textOf(message: Pick<AppendMessage, 'content'>): string {
  return message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}
