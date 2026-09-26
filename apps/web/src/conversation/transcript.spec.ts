import type { AppendMessage } from '@assistant-ui/react';
import { expect, test } from 'vitest';
import { textOf, threadMessageOf } from './transcript';

test('shows the text and tool calls of a message in the thread', () => {
  expect(
    threadMessageOf({
      id: 'm1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-call',
          toolCallId: 'tool-1',
          toolName: 'Read',
          args: { filePath: 'notes.md' },
          result: { content: 'buy milk' },
          isError: false,
        },
        {
          type: 'tool-call',
          toolCallId: 'tool-2',
          toolName: 'Bash',
          args: undefined,
        },
        { type: 'text', text: 'Done.' },
      ],
    }),
  ).toEqual({
    id: 'm1',
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'Read',
        argsText: '{"filePath":"notes.md"}',
        result: { content: 'buy milk' },
        isError: false,
      },
      {
        type: 'tool-call',
        toolCallId: 'tool-2',
        toolName: 'Bash',
        argsText: '{}',
        result: undefined,
        isError: undefined,
      },
      { type: 'text', text: 'Done.' },
    ],
  });
});

test('takes the words of a typed message', () => {
  const message = {
    role: 'user',
    content: [
      { type: 'text', text: 'hello ' },
      { type: 'image', image: 'data:image/png;base64,' },
      { type: 'text', text: 'choir' },
    ],
  } as const satisfies Pick<AppendMessage, 'role' | 'content'>;
  expect(textOf(message)).toBe('hello choir');
});
