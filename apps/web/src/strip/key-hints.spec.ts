import { expect, test } from 'vitest';
import { keyHints } from './key-hints';

function rowsOf(overview: boolean) {
  return keyHints(overview).flatMap(({ rows }) => rows);
}

function row(label: string, overview = false) {
  return rowsOf(overview).find((candidate) => candidate.label === label);
}

test('groups the bindings as niri groups its actions', () => {
  expect(keyHints(false).map(({ name }) => name)).toEqual([
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
  const labels = keyHints(false).flatMap(({ name, rows }) =>
    rows.map(({ label }) => `${name}: ${label}`),
  );
  expect(labels).toHaveLength(30);
  expect(new Set(labels).size).toBe(labels.length);
});

test('lists the overview keys only while the overview is open', () => {
  const closed = keyHints(false).at(-1);
  expect(closed?.rows).toEqual([
    { label: 'Toggle overview', modifiers: ['Alt'], keys: ['O'] },
  ]);
  const open = keyHints(true).at(-1);
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
