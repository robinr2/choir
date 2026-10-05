import { expect, test } from 'vitest';
import { standsAlone } from './tool-groups';

const QUIET = { kind: 'read', status: 'completed', diffs: [], locations: [] };

test('keeps tool calls that need the user or change files out of the tool groups', () => {
  expect(standsAlone({ type: 'text' })).toBe(false);
  expect(standsAlone({ type: 'tool-call', artifact: QUIET })).toBe(false);
  expect(standsAlone({ type: 'tool-call' })).toBe(false);
  expect(
    standsAlone({ type: 'tool-call', artifact: QUIET, approval: { id: 'i1' } }),
  ).toBe(true);
  expect(
    standsAlone({
      type: 'tool-call',
      artifact: { ...QUIET, question: { id: 'i2', questions: [] } },
    }),
  ).toBe(true);
  expect(
    standsAlone({
      type: 'tool-call',
      artifact: {
        ...QUIET,
        diffs: [{ path: '/a', oldText: null, newText: '' }],
      },
    }),
  ).toBe(true);
});
