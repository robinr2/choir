import type { ReactNode } from 'react';
import {
  AssistantRuntimeProvider,
  type RealtimeVoiceAdapter,
  useLocalRuntime,
} from '@assistant-ui/react';
import { coreConversationAdapter } from './core-conversation-adapter';

export function ChatRuntimeProvider({
  voice,
  children,
}: Readonly<{ voice: RealtimeVoiceAdapter; children: ReactNode }>) {
  const runtime = useLocalRuntime(coreConversationAdapter, {
    adapters: { voice },
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
