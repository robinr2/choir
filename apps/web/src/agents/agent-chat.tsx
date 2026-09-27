import { useMemo, useState } from 'react';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { CoreConversation } from '@/conversation/core-conversation';
import { ChatRuntimeProvider } from '@/runtime/chat-runtime-provider';
import { LiveTranscriptComposer } from '@/voice/live-transcript-composer';
import { SpokenReply } from '@/voice/spoken-reply';
import { SpokenReplyFollower } from '@/voice/spoken-reply-follower';
import { AgentContext } from '@/workspace/workspace-context';

export function AgentChat({
  agentId,
  isVoice,
}: Readonly<{ agentId: string; isVoice: boolean }>) {
  const conversation = useMemo(() => new CoreConversation(agentId), [agentId]);
  const [reply] = useState(() => new SpokenReply());
  return (
    <AgentContext value={agentId}>
      <ChatRuntimeProvider conversation={conversation} reply={reply}>
        {isVoice && <LiveTranscriptComposer conversation={conversation} />}
        {isVoice && (
          <SpokenReplyFollower conversation={conversation} reply={reply} />
        )}
        <Thread autoFocus={false} />
      </ChatRuntimeProvider>
    </AgentContext>
  );
}
