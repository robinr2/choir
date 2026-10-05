import { useSyncExternalStore } from 'react';
import { useCoreConversation } from '@/conversation/conversation-context';

export function useSessionFolder(): string | undefined {
  const conversation = useCoreConversation();
  return useSyncExternalStore(
    conversation.subscribe,
    () => conversation.getSnapshot().session?.cwd,
  );
}
