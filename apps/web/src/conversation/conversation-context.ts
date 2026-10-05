import { createContext, use, useSyncExternalStore } from 'react';
import type {
  ConversationSnapshot,
  CoreConversation,
} from './core-conversation';

export const ConversationContext = createContext<CoreConversation | null>(null);

export function useCoreConversation(): CoreConversation {
  const conversation = use(ConversationContext);
  if (!conversation) {
    throw new Error('useConversation needs a ConversationContext');
  }
  return conversation;
}

export function useConversation(): {
  conversation: CoreConversation;
  state: ConversationSnapshot;
} {
  const conversation = useCoreConversation();
  const state = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );
  return { conversation, state };
}
