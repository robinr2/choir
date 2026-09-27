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

export function threadMessageOf(message: ShownMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.parts.map(threadPart),
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

export function textOf(message: Pick<AppendMessage, 'content'>): string {
  return message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}
