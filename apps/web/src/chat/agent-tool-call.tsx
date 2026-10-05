import { useState } from 'react';
import type {
  ToolCallMessagePartComponent,
  ToolCallMessagePartProps,
  ToolCallMessagePartStatus,
} from '@assistant-ui/react';
import { ToolFallback } from '@/components/assistant-ui/elements/tool-fallback.aui';
import { useCoreConversation } from '@/conversation/conversation-context';
import { type ToolDetails, toolDetailsIn } from '@/conversation/thread-message';
import { type Answering, directAnswering, runtimeAnswering } from './answering';
import { ToolApprovalCard } from './tool-approval';
import { ToolDiffs, ToolLocations } from './tool-files';
import { ToolQuestions } from './tool-questions';

const STATUSES: Record<ToolDetails['status'], ToolCallMessagePartStatus> = {
  pending: { type: 'running' },
  in_progress: { type: 'running' },
  completed: { type: 'complete' },
  failed: { type: 'incomplete', reason: 'error' },
};

type ViewProps = Readonly<{
  part: ToolCallMessagePartProps;
  details: ToolDetails;
}>;

function ToolActivity({ part, details }: ViewProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <ToolFallback.Root>
        <ToolFallback.Trigger
          toolName={part.toolName}
          status={STATUSES[details.status]}
        />
        <ToolFallback.Content>
          <ToolFallback.Args argsText={part.argsText} />
          <ToolFallback.Result result={part.result ?? undefined} />
        </ToolFallback.Content>
      </ToolFallback.Root>
      <ToolLocations locations={details.locations} />
      <ToolDiffs diffs={details.diffs} />
    </div>
  );
}

function ToolCallView({
  part,
  answering,
}: Readonly<{ part: ToolCallMessagePartProps; answering: Answering }>) {
  const details = toolDetailsIn(part.artifact);
  if (part.approval) {
    return (
      <ToolApprovalCard
        part={part}
        approval={part.approval}
        details={details}
        answering={answering}
      />
    );
  }
  if (details.question) {
    return <ToolQuestions question={details.question} answering={answering} />;
  }
  return <ToolActivity part={part} details={details} />;
}

export const AgentToolCall: ToolCallMessagePartComponent = (part) => {
  const [answering] = useState(() => runtimeAnswering(part));
  return <ToolCallView part={part} answering={answering} />;
};

export const NestedToolCall: ToolCallMessagePartComponent = (part) => {
  const conversation = useCoreConversation();
  const [answering] = useState(() => directAnswering(conversation));
  return <ToolCallView part={part} answering={answering} />;
};
