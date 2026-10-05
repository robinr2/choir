import { PipecatClientProvider } from '@pipecat-ai/client-react';
import { render } from 'vitest-browser-react';
import { AgentChat } from '@/agents/agent-chat';
import { AgentsContext } from '@/agents/agents-context';
import { CoreAgents } from '@/agents/core-agents';
import { CoreRateLimits } from '@/agents/core-rate-limits';
import { RateLimitsContext } from '@/agents/rate-limits-context';
import { CoreCanvas } from '@/canvas/core-canvas';
import { CoreConversation } from '@/conversation/core-conversation';
import { CoreInbox } from '@/inbox/core-inbox';
import { InboxContext } from '@/inbox/inbox-context';
import { CoreEvents } from '@/lib/core-events';
import { VoiceSession } from '@/voice/voice-session';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { WorkspaceContext } from '@/workspace/workspace-context';
import type { TranscriptPart } from '@/conversation/transcript';
import { coreShowsConversation, toolCall } from './fake-core';
import { requests } from './fake-event-source';
import { client } from './render-app';

const events = new CoreEvents();
const workspace = new CoreWorkspace(events.feed('workspace'));
const inbox = new CoreInbox(events.feed('inbox'));
const agents = new CoreAgents();
const rateLimits = new CoreRateLimits(events.feed('rate-limits'));
const context = {
  workspace,
  voice: new VoiceSession(client, workspace),
  canvas: new CoreCanvas(),
};

export function chatOf(conversation: CoreConversation, isVoice = true) {
  return (
    <PipecatClientProvider client={client}>
      <WorkspaceContext value={context}>
        <InboxContext value={inbox}>
          <AgentsContext value={agents}>
            <RateLimitsContext value={rateLimits}>
              <AgentChat conversation={conversation} isVoice={isVoice} />
            </RateLimitsContext>
          </AgentsContext>
        </InboxContext>
      </WorkspaceContext>
    </PipecatClientProvider>
  );
}

export function renderChat(id: string) {
  return render(
    chatOf(new CoreConversation(id, events.conversation(id)), false),
  );
}

export function coreReplied(id: string, ...parts: TranscriptPart[]): void {
  coreShowsConversation(id, {
    status: { state: 'waiting', since: 0 },
    session: { id: 's1', title: null, cwd: '/work' },
    messages: [{ id: 'm0', role: 'assistant', parts }],
  });
}

export function interactions() {
  return requests().filter(([url]) => url.includes('/interactions/'));
}

export function exploring(...parts: TranscriptPart[]): TranscriptPart {
  return toolCall(
    'sub',
    'Agent',
    { description: 'Explore' },
    {
      kind: 'think',
      status: 'in_progress',
      messages: [{ id: 'm0', role: 'assistant', parts }],
    },
  );
}
