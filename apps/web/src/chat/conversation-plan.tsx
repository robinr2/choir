import { useMemo } from 'react';
import { AgentPlan } from '@/components/assistant-ui/elements/agent-plan';
import { useConversation } from '@/conversation/conversation-context';
import type { StatusState } from '@/conversation/core-conversation';

const RUNNING: ReadonlySet<StatusState> = new Set(['working', 'waiting']);

export function ConversationPlan() {
  const { plan, status: shown } = useConversation().state;
  const steps = useMemo(() => plan.map(({ content }) => content), [plan]);
  const active = plan.findIndex(({ status }) => status !== 'completed');
  if (active < 0 || !RUNNING.has(shown.state)) return null;
  return (
    <AgentPlan steps={steps} activeIndex={active} className="max-w-none px-2" />
  );
}
