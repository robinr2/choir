import { createContext, use, useSyncExternalStore } from 'react';
import type {
  ConversationSnapshot,
  CoreConversation,
} from './core-conversation';

export const ConversationContext = createContext<CoreConversation | null>(null);

export function useConversation(): {
  conversation: CoreConversation;
  state: ConversationSnapshot;
} {
  const conversation = use(ConversationContext);
  if (!conversation) {
    throw new Error('useConversation needs a ConversationContext');
  }
  const state = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );
  return { conversation, state };
}
