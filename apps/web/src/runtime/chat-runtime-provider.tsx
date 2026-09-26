import { type ReactNode, useSyncExternalStore } from 'react';
import {
  type AppendMessage,
  AssistantRuntimeProvider,
  type RealtimeVoiceAdapter,
  type ThreadMessage,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import type { CoreConversation } from '@/conversation/core-conversation';
import {
  textOf,
  threadMessageOf,
  type TranscriptMessage,
} from '@/conversation/transcript';

export function ChatRuntimeProvider({
  conversation,
  voice,
  children,
}: Readonly<{
  conversation: CoreConversation;
  voice: RealtimeVoiceAdapter;
  children: ReactNode;
}>) {
  const { messages, running } = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );
  const runtime = useExternalStoreRuntime<TranscriptMessage>({
    messages,
    isRunning: running,
    convertMessage: threadMessageOf,
    onNew: (message: AppendMessage) => conversation.send(textOf(message)),
    onVoiceTranscript: (message: ThreadMessage) =>
      conversation.adopt({ id: message.id, text: textOf(message) }),
    adapters: { voice },
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
