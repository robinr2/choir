import type { AppendMessage } from '@assistant-ui/react';
import { expect, test } from 'vitest';
import { senderIn, textOf, threadMessageOf } from './transcript';

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
    metadata: { custom: {} },
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

test('shows spoken exchanges as voice messages', () => {
  expect(
    threadMessageOf({
      id: 'm0',
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
      voice: true,
    }),
  ).toEqual({
    id: 'm0',
    role: 'user',
    content: [{ type: 'text', text: 'hello' }],
    metadata: { modality: 'voice', custom: {} },
  });
});

test('marks replies that were spoken and messages from other agents', () => {
  const from = { id: 'a2', name: 'helper' };
  const message = threadMessageOf({
    id: 'm0',
    role: 'user',
    parts: [{ type: 'text', text: 'hello' }],
    from,
  });
  expect(message.metadata).toEqual({ custom: { from } });
  expect(
    threadMessageOf({ id: 'm1', role: 'assistant', parts: [], spoken: true })
      .metadata,
  ).toEqual({ custom: { spoken: true } });
});

test('reads the sender of a message from another agent', () => {
  const from = { id: 'a2', name: 'helper' };
  const nobody = { id: '', name: '' };
  expect(senderIn({ from })).toEqual(from);
  expect(senderIn({})).toEqual(nobody);
  expect(senderIn({ from: null })).toEqual(nobody);
  expect(senderIn({ from: 'helper' })).toEqual(nobody);
  expect(senderIn({ from: { id: 'a2' } })).toEqual(nobody);
  expect(senderIn({ from: { name: 'helper' } })).toEqual(nobody);
});
