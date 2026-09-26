import { useEffect, useState } from 'react';
import { useAui } from '@assistant-ui/react';
import { RTVIEvent } from '@pipecat-ai/client-js';
import { useRTVIClientEvent } from '@pipecat-ai/client-react';
import type { CoreConversation } from '@/conversation/core-conversation';
import { LiveTranscript } from './live-transcript';

export function LiveTranscriptComposer({
  conversation,
}: Readonly<{ conversation: CoreConversation }>) {
  const aui = useAui();
  const [transcript] = useState(
    () => new LiveTranscript((text) => aui.composer.setText(text)),
  );

  useRTVIClientEvent(RTVIEvent.UserTranscript, (data) =>
    transcript.heard(data),
  );

  useEffect(
    () =>
      conversation.subscribe(() =>
        transcript.saw(conversation.getSnapshot().messages),
      ),
    [conversation, transcript],
  );

  return null;
}
