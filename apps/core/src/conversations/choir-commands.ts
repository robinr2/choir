import type { Command } from './session-details.js';

const NAMES = ['branch', 'fork', 'subtask', 'resume'] as const;

export type ChoirCommand = {
  name: (typeof NAMES)[number];
  argument: string;
};

export const CHOIR_COMMANDS: Command[] = [
  {
    name: 'branch',
    description:
      'Branch the conversation into a new session and continue there, leaving the original as it is',
    hint: '[name]',
  },
  {
    name: 'fork',
    description:
      'Fork the conversation into a background agent, optionally with a prompt',
    hint: '[prompt]',
  },
  {
    name: 'subtask',
    description:
      'Hand a task to a background subagent that knows the whole conversation',
    hint: '<task>',
  },
  {
    name: 'resume',
    description: 'Switch the conversation to an earlier session',
    hint: '[session id]',
  },
];

export function choirCommand(text: string): ChoirCommand | undefined {
  const trimmed = text.trim();
  const word = trimmed.replace(/\s.*/s, '');
  const name = NAMES.find((candidate) => `/${candidate}` === word);
  return name && { name, argument: trimmed.slice(word.length).trim() };
}

export function subtaskPrompt(task: string): string {
  return `Use the Agent tool with subagent_type "fork" and run_in_background: true to do the following task in the background, then go on without waiting for it:\n\n${task}`;
}
