import type { ToolCallMessagePart } from '@assistant-ui/react';
import type {
  ApprovalChoice,
  ApprovalState,
} from '@/components/assistant-ui/elements/approval-card';
import type { ToolCallPart } from '@/conversation/transcript';

export type ToolApproval = NonNullable<ToolCallMessagePart['approval']>;

type ApprovalView = { state: ApprovalState; label?: string };

const RUNNING: ReadonlySet<ToolCallPart['status']> = new Set([
  'pending',
  'in_progress',
]);

export function choicesOf({ options = [] }: ToolApproval): ApprovalChoice[] {
  return options.map(({ id, label }) => ({ id, label: label ?? id }));
}

function chosenLabel({ options = [], optionId }: ToolApproval) {
  return options.find(({ id }) => id === optionId)?.label;
}

export function approvalViewOf(
  approval: ToolApproval,
  status: ToolCallPart['status'],
): ApprovalView {
  if (approval.resolution) return { state: 'denied', label: 'Cancelled' };
  if (approval.approved === undefined) return { state: 'request' };
  const label = chosenLabel(approval);
  if (!approval.approved) return { state: 'denied', label };
  return { state: RUNNING.has(status) ? 'running' : 'done', label };
}

type Args = Readonly<Record<string, unknown>>;

function textArg(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

export function commandOf(args: Args): string | undefined {
  return textArg(args, 'command');
}

export function planOf(args: Args): string | undefined {
  return textArg(args, 'plan');
}
