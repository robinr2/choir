import { expect, test } from 'vitest';
import { toolCall } from '@/test/fake-core';
import { senderIn, spokenTextsOf, textBefore, userTurnsIn } from './transcript';

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
        toolCall('t', 'Read', {}),
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
