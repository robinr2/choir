import { type ReactNode, useMemo, useSyncExternalStore } from 'react';
import {
  type AppendMessage,
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import type { CoreConversation } from '@/conversation/core-conversation';
import {
  type ShownMessage,
  textOf,
  threadMessageOf,
} from '@/conversation/transcript';
import { withSpeech } from '@/voice/spoken-messages';
import type { SpokenReply } from '@/voice/spoken-reply';

export function ChatRuntimeProvider({
  conversation,
  reply,
  children,
}: Readonly<{
  conversation: CoreConversation;
  reply: Pick<SpokenReply, 'subscribe' | 'getSnapshot'>;
  children: ReactNode;
}>) {
  const { messages, running } = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );
  const speech = useSyncExternalStore(reply.subscribe, reply.getSnapshot);
  const shown = useMemo(() => withSpeech(messages, speech), [messages, speech]);
  const runtime = useExternalStoreRuntime<ShownMessage>({
    messages: shown,
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
