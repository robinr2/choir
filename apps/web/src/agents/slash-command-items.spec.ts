import { expect, test } from 'vitest';
import {
  commandAdapter,
  commandFormatter,
  leadingCommand,
  sendsRightAway,
} from './slash-command-items';

const adapter = commandAdapter([
  { name: 'compact', description: 'Compact the conversation', hint: null },
  { name: 'branch', description: 'Branch off', hint: '[name]' },
  {
    name: 'subtask',
    description: 'Run a task in the background',
    hint: '<task>',
  },
  { name: 'resume', description: 'Resume a session', hint: '[session id]' },
]);

function items(query: string) {
  return adapter.search?.(query) ?? [];
}

function names(query: string): string[] {
  return items(query).map(({ id }) => id);
}

test('lists every command, those starting with the query first', () => {
  expect(adapter.categories()).toEqual([]);
  expect(adapter.categoryItems('any')).toEqual([]);
  expect(names('')).toEqual(['compact', 'branch', 'subtask', 'resume']);
  expect(names('S')).toEqual(['subtask', 'resume']);
  expect(names('a')).toEqual(['compact', 'branch', 'subtask']);
  expect(names('task')).toEqual(['subtask']);
  expect(names('r')).toEqual(['resume', 'branch']);
  expect(names('background')).toEqual([]);
});

test('describes each command and whether choosing it sends it', () => {
  const [compact, branch, , resume] = items('');
  expect(compact).toEqual({
    id: 'compact',
    type: 'command',
    label: '/compact',
    description: 'Compact the conversation',
    metadata: { hint: null, sends: true },
  });
  expect(branch).toHaveProperty('metadata', { hint: '[name]', sends: false });
  expect(resume).toHaveProperty('metadata', {
    hint: '[session id]',
    sends: true,
  });
});

test('sends only commands marked to be sent right away', () => {
  const [compact] = items('compact');
  expect(compact && sendsRightAway(compact)).toBe(true);
  expect(sendsRightAway({ id: 'x', type: 'command', label: '/x' })).toBe(false);
});

test('writes a chosen command into the composer as plain text', () => {
  expect(
    commandFormatter.serialize({
      id: 'branch',
      type: 'command',
      label: '/branch',
    }),
  ).toBe('/branch');
  expect(commandFormatter.parse('/branch x')).toEqual([
    { kind: 'text', text: '/branch x' },
  ]);
});

test('finds a command only at the start of the message, up to a space', () => {
  expect(leadingCommand('/bra', '/', 4)).toEqual({
    query: 'bra',
    offset: 0,
    endOffset: 4,
  });
  expect(leadingCommand('/branch name', '/', 3)).toEqual({
    query: 'br',
    offset: 0,
    endOffset: 3,
  });
  expect(leadingCommand('/branch name', '/', 9)).toBeNull();
  expect(leadingCommand('see /branch', '/', 11)).toBeNull();
});
