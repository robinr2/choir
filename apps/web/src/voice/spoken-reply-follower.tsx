import { useCallback, useEffect } from 'react';
import { type BotOutputData, RTVIEvent } from '@pipecat-ai/client-js';
import { useRTVIClientEvent } from '@pipecat-ai/client-react';
import type { CoreConversation } from '@/conversation/core-conversation';
import type { SpokenReply } from './spoken-reply';

export function SpokenReplyFollower({
  conversation,
  reply,
}: Readonly<{ conversation: CoreConversation; reply: SpokenReply }>) {
  useRTVIClientEvent(
    RTVIEvent.BotOutput,
    useCallback((data: BotOutputData) => reply.heard(data), [reply]),
  );

  useEffect(() => {
    const follow = () => {
      const { loaded, messages } = conversation.getSnapshot();
      if (loaded) reply.saw(messages);
    };
    follow();
    const stop = conversation.subscribe(follow);
    return () => {
      stop();
      reply.restart();
    };
  }, [conversation, reply]);

  return null;
}
