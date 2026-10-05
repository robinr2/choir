import { expect, test } from 'vitest';
import type { ElicitationPart } from '@/conversation/transcript';
import { acceptance, initialValues, shownFields } from './elicitation-answers';

const FIELDS: ElicitationPart['fields'] = [
  { name: 'repo', label: 'Repository', kind: 'text', required: true },
  {
    name: 'color',
    label: 'Color',
    kind: 'choice',
    options: ['red', 'blue'],
    required: false,
  },
  { name: 'notify', label: 'Notify', kind: 'toggle', required: false },
  { name: 'count', label: 'Count', kind: 'number', required: false },
];

test('starts with empty fields and switched off toggles', () => {
  const values = initialValues(FIELDS);
  expect(values).toEqual({ repo: '', color: '', notify: 'false', count: '' });
  expect(shownFields(FIELDS, { ...values, repo: 'choir' })).toEqual([
    {
      name: 'repo',
      label: 'Repository',
      kind: 'text',
      required: true,
      value: 'choir',
    },
    {
      name: 'color',
      label: 'Color',
      kind: 'choice',
      required: false,
      value: '',
      options: ['red', 'blue'],
    },
    {
      name: 'notify',
      label: 'Notify',
      kind: 'toggle',
      required: false,
      value: 'false',
    },
    {
      name: 'count',
      label: 'Count',
      kind: 'number',
      required: false,
      value: '',
    },
  ]);
  expect(shownFields(FIELDS, {})[0]?.value).toBe('');
});

test('sends the filled fields in their own types', () => {
  expect(
    acceptance(FIELDS, {
      repo: 'choir',
      color: '',
      notify: 'true',
      count: '3',
    }),
  ).toEqual({
    action: 'accept',
    content: { repo: 'choir', notify: true, count: 3 },
  });
  expect(acceptance(FIELDS, { notify: 'false', color: 'red' })).toEqual({
    action: 'accept',
    content: { notify: false, color: 'red' },
  });
});
