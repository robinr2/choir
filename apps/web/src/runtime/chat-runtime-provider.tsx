import { type ReactNode, useMemo, useState, useSyncExternalStore } from 'react';
import {
  AssistantRuntimeProvider,
  SimpleImageAttachmentAdapter,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import type {
  CoreConversation,
  StatusState,
} from '@/conversation/core-conversation';
import { threadMessageOf } from '@/conversation/thread-message';
import type { ShownMessage } from '@/conversation/transcript';
import { TodoDropZone } from '@/inbox/todo-drop-zone';
import { withSpeech } from '@/voice/spoken-messages';
import type { SpokenReply } from '@/voice/spoken-reply';
import { chatAnswersOf } from './chat-answers';
import { chatQueueOf } from './chat-queue';

const RUNNING: ReadonlySet<StatusState> = new Set(['working', 'waiting']);

type ChatProps = Readonly<{
  conversation: CoreConversation;
  reply: Pick<SpokenReply, 'subscribe' | 'getSnapshot'>;
  onResume: (open: true) => void;
}>;

function useChatRuntime({ conversation, reply, onResume }: ChatProps) {
  const { messages, status, queue } = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );
  const speech = useSyncExternalStore(reply.subscribe, reply.getSnapshot);
  const shown = useMemo(() => withSpeech(messages, speech), [messages, speech]);
  const chatQueue = useMemo(
    () => chatQueueOf(conversation, queue, onResume),
    [conversation, queue, onResume],
  );
  const answers = useMemo(() => chatAnswersOf(conversation), [conversation]);
  const [attachments] = useState(() => new SimpleImageAttachmentAdapter());
  return useExternalStoreRuntime<ShownMessage>({
    messages: shown,
    isRunning: RUNNING.has(status.state),
    convertMessage: threadMessageOf,
    onNew: chatQueue.submit,
    onCancel: () => conversation.cancel(),
    queue: chatQueue,
    adapters: { attachments },
    ...answers,
  });
}

export function ChatRuntimeProvider({
  children,
  ...chat
}: ChatProps & Readonly<{ children: ReactNode }>) {
  const runtime = useChatRuntime(chat);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TodoDropZone>{children}</TodoDropZone>
    </AssistantRuntimeProvider>
  );
}
