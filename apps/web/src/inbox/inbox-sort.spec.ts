import { expect, test } from 'vitest';
import { sorted } from './inbox-sort';

const entries = [
  {
    id: 'a',
    dueAt: '2026-10-02T10:00:00Z',
    createdAt: '2026-09-28T07:00:00.5Z',
  },
  { id: 'b', dueAt: null, createdAt: '2026-09-28T07:00:00Z' },
  { id: 'c', dueAt: '2026-10-01T10:00:00Z', createdAt: '2026-09-28T09:00:00Z' },
  { id: 'd', dueAt: null, createdAt: '2026-09-28T08:00:00Z' },
];

function ids(list: { id: string }[]): string[] {
  return list.map(({ id }) => id);
}

test('keeps the order of the user', () => {
  const list = sorted(entries, { field: 'position', direction: 'desc' });
  expect(ids(list)).toEqual(['a', 'b', 'c', 'd']);
  expect(list).not.toBe(entries);
});

test('sorts by a date both ways, entries without one last', () => {
  expect(ids(sorted(entries, { field: 'dueAt', direction: 'asc' }))).toEqual([
    'c',
    'a',
    'b',
    'd',
  ]);
  expect(ids(sorted(entries, { field: 'dueAt', direction: 'desc' }))).toEqual([
    'a',
    'c',
    'b',
    'd',
  ]);
  expect(
    ids(sorted(entries, { field: 'createdAt', direction: 'asc' })),
  ).toEqual(['b', 'a', 'd', 'c']);
  expect(
    ids(sorted(entries, { field: 'createdAt', direction: 'desc' })),
  ).toEqual(['c', 'd', 'a', 'b']);
});

test('keeps entries with the same date in the order of the user', () => {
  const same = [
    { id: 'x', updatedAt: '2026-09-28T07:00:00Z' },
    { id: 'y', updatedAt: '2026-09-28T07:00:00Z' },
  ];
  expect(ids(sorted(same, { field: 'updatedAt', direction: 'asc' }))).toEqual([
    'x',
    'y',
  ]);
  expect(ids(sorted(same, { field: 'updatedAt', direction: 'desc' }))).toEqual([
    'x',
    'y',
  ]);
});
