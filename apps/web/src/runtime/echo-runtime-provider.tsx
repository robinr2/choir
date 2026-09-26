import type { ReactNode } from 'react';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from '@assistant-ui/react';

const echoAdapter: ChatModelAdapter = {
  async run({ messages }) {
    const content = messages
      .slice(-1)
      .flatMap((message) => message.content.map((part) => part))
      .filter((part) => part.type === 'text');
    return { content };
  },
};

export function EchoRuntimeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const runtime = useLocalRuntime(echoAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
