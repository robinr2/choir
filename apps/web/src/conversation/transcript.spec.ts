import type { AppendMessage } from '@assistant-ui/react';
import { expect, test } from 'vitest';
import {
  isSpokenIn,
  senderIn,
  spokenTextsOf,
  textBefore,
  textOf,
  threadMessageOf,
  userTurnsIn,
} from './transcript';

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

test('shows spoken exchanges like typed ones', () => {
  expect(
    threadMessageOf({
      id: 'm0',
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
    }),
  ).toEqual({
    id: 'm0',
    role: 'user',
    content: [{ type: 'text', text: 'hello' }],
    metadata: { custom: {} },
  });
});

test('passes on how much of a reply was spoken', () => {
  const message = threadMessageOf({
    id: 'm1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Hello.' }],
    spoken: true,
    spokenUpTo: 0,
  });
  expect(message.metadata).toEqual({ custom: { spokenUpTo: 0 } });
  expect(isSpokenIn({ spokenUpTo: 0 })).toBe(true);
  expect(isSpokenIn({})).toBe(false);
});

test('counts the text that comes before a part of a message', () => {
  const parts = [
    { type: 'text', text: 'Let me look.' },
    { type: 'reasoning', text: 'hmm' },
    { type: 'text', text: 'Found it.' },
  ];
  expect(textBefore(parts, { type: 'index', index: 2 })).toBe(12);
  expect(textBefore(parts, { type: 'index', index: 0 })).toBe(0);
  expect(textBefore(parts, { type: 'toolCallId', toolCallId: 't' })).toBe(0);
  expect(textBefore(parts, null)).toBe(0);
});

test('reads the text parts a reply speaks and counts the user turns', () => {
  expect(
    spokenTextsOf({
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Let me look.' },
        { type: 'tool-call', toolCallId: 't', toolName: 'Read', args: {} },
        { type: 'text', text: '  ' },
        { type: 'text', text: 'Found it.' },
      ],
    }),
  ).toEqual(['Let me look.', 'Found it.']);
  expect(
    userTurnsIn([
      { id: 'm0', role: 'user', parts: [] },
      { id: 'm1', role: 'assistant', parts: [] },
      { id: 'm2', role: 'user', parts: [] },
    ]),
  ).toBe(2);
});

test('marks messages from other agents', () => {
  const from = { id: 'a2', name: 'helper' };
  const message = threadMessageOf({
    id: 'm0',
    role: 'user',
    parts: [{ type: 'text', text: 'hello' }],
    from,
  });
  expect(message.metadata).toStrictEqual({ custom: { from } });
  expect(
    threadMessageOf({ id: 'm1', role: 'assistant', parts: [], spoken: true })
      .metadata,
  ).toStrictEqual({ custom: {} });
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
