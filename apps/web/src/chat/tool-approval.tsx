import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import {
  ApprovalCard,
  type ApprovalState,
} from '@/components/assistant-ui/elements/approval-card';
import type { ToolDetails } from '@/conversation/thread-message';
import type { Answering } from './answering';
import {
  approvalViewOf,
  choicesOf,
  commandOf,
  planOf,
  type ToolApproval,
} from './approval-view';
import { MarkdownBlock } from './markdown-block';
import { toolIconOf } from './tool-icons';
import { ToolDiffs, ToolLocations } from './tool-files';

const SUBTITLES = {
  request: 'Waits for your approval',
  running: 'Approved',
  done: 'Approved',
  denied: 'Not approved',
} as const;

function subtitleOf(
  { prompt }: ToolApproval,
  title: string,
  state: ApprovalState,
): string {
  return prompt && prompt !== title ? prompt : SUBTITLES[state];
}

type ApprovalProps = Readonly<{
  part: ToolCallMessagePartProps;
  approval: ToolApproval;
  details: ToolDetails;
  answering: Answering;
}>;

export function ToolApprovalCard({
  part,
  approval,
  details,
  answering,
}: ApprovalProps) {
  const { state, label } = approvalViewOf(approval, details.status);
  const plan = planOf(part.args);
  return (
    <ApprovalCard
      state={state}
      title={part.toolName}
      subtitle={subtitleOf(approval, part.toolName, state)}
      iconType={toolIconOf(details.kind)}
      command={commandOf(part.args)}
      choices={choicesOf(approval)}
      approvalId={approval.id}
      onChoose={answering.choose}
      statusLabel={label}
      className="my-1 max-w-none"
    >
      {plan && <MarkdownBlock text={plan} />}
      <ToolLocations locations={details.locations} />
      <ToolDiffs diffs={details.diffs} />
    </ApprovalCard>
  );
}
