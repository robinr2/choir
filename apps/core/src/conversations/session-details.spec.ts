import { NO_DETAILS, withDetails } from './session-details.js';

it('follows the usage of the session and keeps the last cost', () => {
  const used = withDetails(NO_DETAILS, {
    sessionUpdate: 'usage_update',
    used: 10,
    size: 100,
  });
  expect(used.usage).toEqual({ used: 10, size: 100, cost: null });
  const paid = withDetails(used, {
    sessionUpdate: 'usage_update',
    used: 20,
    size: 100,
    cost: { amount: 0.5, currency: 'USD' },
  });
  expect(paid.usage).toEqual({ used: 20, size: 100, cost: 0.5 });
  expect(
    withDetails(paid, {
      sessionUpdate: 'usage_update',
      used: 30,
      size: 100,
      cost: null,
    }).usage,
  ).toEqual({ used: 30, size: 100, cost: 0.5 });
});

it('follows the commands, plan and title of the session', () => {
  const commanded = withDetails(NO_DETAILS, {
    sessionUpdate: 'available_commands_update',
    availableCommands: [
      { name: 'compact', description: 'Compact' },
      { name: 'review', description: 'Review', input: { hint: 'pr' } },
    ],
  });
  expect(commanded.commands).toEqual([
    { name: 'compact', description: 'Compact', hint: null },
    { name: 'review', description: 'Review', hint: 'pr' },
  ]);
  const planned = withDetails(commanded, {
    sessionUpdate: 'plan',
    entries: [{ content: 'Read', status: 'in_progress', priority: 'high' }],
  });
  expect(planned.plan).toEqual([{ content: 'Read', status: 'in_progress' }]);
  const titled = withDetails(planned, {
    sessionUpdate: 'session_info_update',
    title: 'Notes',
  });
  expect(titled).toEqual({ ...planned, title: 'Notes' });
  expect(
    withDetails(titled, {
      sessionUpdate: 'session_info_update',
      updatedAt: 'now',
    }),
  ).toBe(titled);
  expect(
    withDetails(titled, {
      sessionUpdate: 'current_mode_update',
      currentModeId: 'plan',
    }),
  ).toBe(titled);
});
