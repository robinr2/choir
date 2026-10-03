import { expect, test } from 'vitest';
import { todoReference } from './todo-reference';

test('names the to-do by title for the user and by ID for the agent', () => {
  expect(todoReference({ id: 't1', title: 'Check the logs' })).toBe(
    'To-do "Check the logs" (ID t1)',
  );
});
