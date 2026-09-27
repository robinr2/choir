import { RTVIEvent } from '@pipecat-ai/client-js';
import { PipecatClientProvider } from '@pipecat-ai/client-react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { A, B, coreShowsChat, fakeCore } from '@/test/fake-core';
import { streamOf } from '@/test/fake-event-source';
import { client } from '@/test/render-app';
import { VoiceSession } from '@/voice/voice-session';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { WorkspaceContext } from '@/workspace/workspace-context';
import { AgentChat } from './agent-chat';

const workspace = new CoreWorkspace();
const context = { workspace, voice: new VoiceSession(client, workspace) };

function chatOf(agentId: string) {
  return (
    <PipecatClientProvider client={client}>
      <WorkspaceContext value={context}>
        <AgentChat agentId={agentId} isVoice />
      </WorkspaceContext>
    </PipecatClientProvider>
  );
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('follows the agent it was last given', async () => {
  const screen = await render(chatOf(A));
  await screen.rerender(chatOf(B));
  await vi.waitFor(() =>
    expect(streamOf(`/conversations/${B}/events`)).toBeDefined(),
  );
  client.emit(RTVIEvent.UserTranscript, {
    text: 'hi',
    final: true,
    timestamp: '',
    user_id: '',
  });
  const composer = screen.getByRole('textbox');
  await expect.element(composer).toHaveValue('hi');
  coreShowsChat(B, {
    id: 'm0',
    role: 'user',
    parts: [{ type: 'text', text: 'hi' }],
    voice: true,
  });
  await expect.element(composer).toHaveValue('');
});
