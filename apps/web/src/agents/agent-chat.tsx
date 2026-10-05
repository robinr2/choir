import { useState } from 'react';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { ConversationContext } from '@/conversation/conversation-context';
import type { CoreConversation } from '@/conversation/core-conversation';
import { ChatRuntimeProvider } from '@/runtime/chat-runtime-provider';
import { LiveTranscriptComposer } from '@/voice/live-transcript-composer';
import { SpokenReply } from '@/voice/spoken-reply';
import { SpokenReplyFollower } from '@/voice/spoken-reply-follower';
import { AgentContext } from '@/workspace/workspace-context';
import { ResumeDialog } from './resume-dialog';

export function AgentChat({
  conversation,
  isVoice,
}: Readonly<{ conversation: CoreConversation; isVoice: boolean }>) {
  const [reply] = useState(() => new SpokenReply());
  const [resuming, setResuming] = useState(false);
  return (
    <AgentContext value={conversation.id}>
      <ConversationContext value={conversation}>
        <ChatRuntimeProvider
          conversation={conversation}
          reply={reply}
          onResume={setResuming}
        >
          {isVoice && <LiveTranscriptComposer conversation={conversation} />}
          {isVoice && (
            <SpokenReplyFollower conversation={conversation} reply={reply} />
          )}
          <Thread autoFocus={false} />
          <ResumeDialog open={resuming} onOpenChange={setResuming} />
        </ChatRuntimeProvider>
      </ConversationContext>
    </AgentContext>
  );
}
