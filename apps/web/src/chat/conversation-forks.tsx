import { useMemo, useState } from 'react';
import {
  type BackgroundRun,
  BackgroundInbox,
} from '@/components/assistant-ui/elements/background-inbox';
import { useConversation } from '@/conversation/conversation-context';
import type { Fork } from '@/conversation/core-conversation';
import { useNow } from '@/lib/use-now';
import { elapsed } from '@/panes/agent-status';
import { useWorkspace } from '@/workspace/workspace-context';

function runOf(fork: Fork, now: number): BackgroundRun {
  return {
    id: fork.id,
    title: fork.title,
    state: fork.state,
    elapsed: elapsed(fork.startedAt, fork.endedAt ?? now),
  };
}

export function ConversationForks() {
  const { conversation, state } = useConversation();
  const { forks } = state;
  const { workspace } = useWorkspace();
  const now = useNow(forks.some((fork) => fork.state === 'running'));
  const runs = useMemo(
    () => forks.map((fork) => runOf(fork, now)),
    [forks, now],
  );
  const [open] = useState(
    () => (id: string) => void workspace.openConversation(id, conversation.id),
  );
  if (forks.length === 0) return null;
  return (
    <BackgroundInbox
      title="Forks"
      runs={runs}
      onCollect={open}
      className="max-w-none"
    />
  );
}
