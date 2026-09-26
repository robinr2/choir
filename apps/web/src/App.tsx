import { useMemo } from 'react';
import type { PipecatClient } from '@pipecat-ai/client-js';
import {
  PipecatClientAudio,
  PipecatClientProvider,
} from '@pipecat-ai/client-react';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { CoreConversation } from '@/conversation/core-conversation';
import { ChatRuntimeProvider } from '@/runtime/chat-runtime-provider';
import { LiveTranscriptComposer } from '@/voice/live-transcript-composer';
import { PipecatVoiceAdapter } from '@/voice/pipecat-voice-adapter';

function App({
  client,
  conversationId,
}: Readonly<{ client: PipecatClient; conversationId: string }>) {
  const conversation = useMemo(
    () => new CoreConversation(conversationId),
    [conversationId],
  );
  const voice = useMemo(
    () => new PipecatVoiceAdapter(client, conversationId),
    [client, conversationId],
  );
  return (
    <PipecatClientProvider client={client}>
      <ChatRuntimeProvider conversation={conversation} voice={voice}>
        <LiveTranscriptComposer conversation={conversation} />
        <div className="h-dvh">
          <Thread />
        </div>
      </ChatRuntimeProvider>
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}

export default App;
