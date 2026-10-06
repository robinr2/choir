import { expect, test } from 'vitest';
import { keyHints } from './key-hints';

const US = new Map<string, string>();

function rowsOf(overview: boolean) {
  return keyHints(overview, US).flatMap(({ rows }) => rows);
}

function row(label: string, overview = false) {
  return rowsOf(overview).find((candidate) => candidate.label === label);
}

test('groups the bindings as niri groups its actions', () => {
  expect(keyHints(false, US).map(({ name }) => name)).toEqual([
    'Focus',
    'Move',
    'Workspaces',
    'Size',
    'Panes',
    'Overview',
  ]);
});

test('shows a key and its twin as one row, letter first', () => {
  expect(row('Column left')).toEqual({
    label: 'Column left',
    modifiers: ['Alt'],
    keys: ['H', '←'],
  });
  expect(row('Send pane down')).toEqual({
    label: 'Send pane down',
    modifiers: ['Alt', 'Ctrl', 'Shift'],
    keys: ['U', 'PgDn'],
  });
  expect(row('Pane above')?.keys).toEqual(['K', '↑']);
  expect(row('Workspace above')?.keys).toEqual(['I', 'PgUp']);
});

test.each([
  ['Consume or expel left', '['],
  ['Consume or expel right', ']'],
  ['Consume into column', ','],
  ['Expel from column', '.'],
  ['Narrower column', '-'],
  ['Wider column', '='],
  ['Taller pane', '='],
])('names the symbol key of %s', (label, key) => {
  expect(row(label)?.keys).toEqual([key]);
});

test('keeps Shift with the keys it changes', () => {
  expect(row('Shorter pane')?.modifiers).toEqual(['Alt', 'Shift']);
});

test('labels every binding once', () => {
  const labels = keyHints(false, US).map(({ name, rows }) => [
    name,
    rows.map(({ label }) => label),
  ]);
  expect(Object.fromEntries(labels)).toEqual({
    Focus: ['Pane below', 'Pane above', 'Column left', 'Column right'],
    Move: ['Column left', 'Column right', 'Pane down', 'Pane up'],
    Workspaces: [
      'Workspace below',
      'Workspace above',
      'Send column down',
      'Send column up',
      'Move workspace down',
      'Move workspace up',
      'Send pane down',
      'Send pane up',
    ],
    Size: [
      'Narrower column',
      'Wider column',
      'Shorter pane',
      'Taller pane',
      'Reset pane height',
      'Maximize column',
      'Fill the free width',
    ],
    Panes: [
      'Close pane',
      'Open pane',
      'Consume or expel left',
      'Consume or expel right',
      'Consume into column',
      'Expel from column',
    ],
    Overview: ['Toggle overview'],
  });
});

test('lists the overview keys only while the overview is open', () => {
  const closed = keyHints(false, US).at(-1);
  expect(closed?.rows).toEqual([
    { label: 'Toggle overview', modifiers: ['Alt'], keys: ['O'] },
  ]);
  const open = keyHints(true, US).at(-1);
  expect(open?.name).toBe('Overview');
  expect(open?.rows).toEqual([
    { label: 'Toggle overview', modifiers: ['Alt'], keys: ['O'] },
    { label: 'Close overview', modifiers: [], keys: ['Esc', 'Enter'] },
    { label: 'Column left', modifiers: [], keys: ['←'] },
    { label: 'Column right', modifiers: [], keys: ['→'] },
    { label: 'Pane above', modifiers: [], keys: ['↑'] },
    { label: 'Pane below', modifiers: [], keys: ['↓'] },
  ]);
});

test('names each key by what it types on the current layout', () => {
  const german = new Map([
    ['BracketLeft', 'ü'],
    ['BracketRight', '+'],
    ['KeyJ', 'j'],
    ['Minus', 'ß'],
  ]);
  const keysOf = (label: string) =>
    keyHints(false, german)
      .flatMap(({ rows }) => rows)
      .find((candidate) => candidate.label === label)?.keys;
  expect(keysOf('Consume or expel left')).toEqual(['Ü']);
  expect(keysOf('Consume or expel right')).toEqual(['+']);
  expect(keysOf('Pane below')).toEqual(['J', '↓']);
  expect(keysOf('Narrower column')).toEqual(['ß']);
  expect(keysOf('Expel from column')).toEqual(['.']);
});
