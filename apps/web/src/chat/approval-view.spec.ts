import { expect, test } from 'vitest';
import { approvalViewOf, choicesOf } from './approval-view';

test('offers nothing and names no choice for an approval without options', () => {
  expect(choicesOf({ id: 'i1' })).toEqual([]);
  expect(
    choicesOf({ id: 'i1', options: [{ id: 'go', kind: 'allow-once' }] }),
  ).toEqual([{ id: 'go', label: 'go' }]);
  expect(approvalViewOf({ id: 'i1', approved: true }, 'completed')).toEqual({
    state: 'done',
    label: undefined,
  });
});
