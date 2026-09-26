import { useMemo } from 'react';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { CoreConversation } from '@/conversation/core-conversation';
import { ChatRuntimeProvider } from '@/runtime/chat-runtime-provider';
import { LiveTranscriptComposer } from '@/voice/live-transcript-composer';
import { AgentContext } from '@/workspace/workspace-context';

export function AgentChat({
  agentId,
  isVoice,
}: Readonly<{ agentId: string; isVoice: boolean }>) {
  const conversation = useMemo(() => new CoreConversation(agentId), [agentId]);
  return (
    <AgentContext value={agentId}>
      <ChatRuntimeProvider conversation={conversation}>
        {isVoice && <LiveTranscriptComposer conversation={conversation} />}
        <Thread autoFocus={false} />
      </ChatRuntimeProvider>
    </AgentContext>
  );
}
