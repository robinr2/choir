import { type ReactNode, useSyncExternalStore } from 'react';
import {
  type AppendMessage,
  AssistantRuntimeProvider,
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
  children,
}: Readonly<{
  conversation: CoreConversation;
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
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
