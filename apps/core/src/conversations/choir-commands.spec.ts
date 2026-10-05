import {
  CHOIR_COMMANDS,
  choirCommand,
  subtaskPrompt,
} from './choir-commands.js';

it('recognizes the commands choir runs itself and what follows them', () => {
  expect(choirCommand('/branch')).toEqual({ name: 'branch', argument: '' });
  expect(choirCommand('  /fork  write the\ntests  ')).toEqual({
    name: 'fork',
    argument: 'write the\ntests',
  });
  expect(choirCommand('/subtask x')).toEqual({
    name: 'subtask',
    argument: 'x',
  });
  expect(choirCommand('/resume s1')).toEqual({
    name: 'resume',
    argument: 's1',
  });
  expect(choirCommand('/compact')).toBeUndefined();
  expect(choirCommand('/branches')).toBeUndefined();
  expect(choirCommand('please /fork')).toBeUndefined();
  expect(choirCommand('fork')).toBeUndefined();
});

it('describes its commands with the arguments they take', () => {
  expect(CHOIR_COMMANDS.map(({ name, hint }) => [name, hint])).toEqual([
    ['branch', '[name]'],
    ['fork', '[prompt]'],
    ['subtask', '<task>'],
    ['resume', '[session id]'],
  ]);
  expect(
    CHOIR_COMMANDS.every(({ description }) => description.length > 20),
  ).toBe(true);
});

it('asks the agent to run a subtask in a background fork of itself', () => {
  expect(subtaskPrompt('write tests')).toBe(
    'Use the Agent tool with subagent_type "fork" and run_in_background: true to do the following task in the background, then go on without waiting for it:\n\nwrite tests',
  );
});
