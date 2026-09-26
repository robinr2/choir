import { useMemo } from 'react';
import type { PipecatClient } from '@pipecat-ai/client-js';
import {
  PipecatClientAudio,
  PipecatClientProvider,
} from '@pipecat-ai/client-react';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { ChatRuntimeProvider } from '@/runtime/chat-runtime-provider';
import { PipecatVoiceAdapter } from '@/voice/pipecat-voice-adapter';

function App({ client }: Readonly<{ client: PipecatClient }>) {
  const voice = useMemo(() => new PipecatVoiceAdapter(client), [client]);
  return (
    <PipecatClientProvider client={client}>
      <ChatRuntimeProvider voice={voice}>
        <div className="h-dvh">
          <Thread />
        </div>
      </ChatRuntimeProvider>
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}

export default App;
