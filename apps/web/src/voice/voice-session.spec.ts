import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoreEvents } from '@/lib/core-events';
import { A, B } from '@/test/fake-core';
import { fakeEventSources } from '@/test/fake-event-source';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { createPipecatClient } from './create-pipecat-client';
import { VoiceSession } from './voice-session';

const client = createPipecatClient();
let workspace: CoreWorkspace;
let session: VoiceSession;

function stubClient(connect = Promise.resolve({ version: '1.0.0' })) {
  return {
    connect: vi.spyOn(client, 'connect').mockReturnValue(connect),
    disconnect: vi.spyOn(client, 'disconnect').mockResolvedValue(),
  };
}

beforeEach(() => {
  vi.spyOn(window, 'fetch').mockResolvedValue(
    new Response(null, { status: 204 }),
  );
  fakeEventSources();
  workspace = new CoreWorkspace(new CoreEvents().feed('workspace'));
  session = new VoiceSession(client, workspace);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('points voice at an agent and connects once', async () => {
  const { connect } = stubClient();
  await session.toggle(A);
  expect(workspace.getSnapshot().voiceAgentId).toBe(A);
  expect(connect).toHaveBeenCalledExactlyOnceWith({
    webrtcRequestParams: { endpoint: '/api/offer' },
  });
  await session.toggle(B);
  expect(workspace.getSnapshot().voiceAgentId).toBe(B);
  expect(connect).toHaveBeenCalledOnce();
});

test('turns voice off when the voice agent is pressed again', async () => {
  const { connect, disconnect } = stubClient();
  await session.toggle(A);
  await session.toggle(A);
  expect(workspace.getSnapshot().voiceAgentId).toBeNull();
  expect(disconnect).toHaveBeenCalledOnce();
  await session.toggle(B);
  expect(connect).toHaveBeenCalledTimes(2);
});

test('turns voice off when connecting fails', async () => {
  const { connect, disconnect } = stubClient(
    Promise.reject(new Error('no bot')),
  );
  await session.toggle(A);
  expect(workspace.getSnapshot().voiceAgentId).toBeNull();
  expect(disconnect).not.toHaveBeenCalled();
  await session.toggle(B);
  expect(connect).toHaveBeenCalledTimes(2);
});

test('disconnects once core turns voice off', async () => {
  const { disconnect } = stubClient();
  const stop = session.follow();
  await session.toggle(A);
  await workspace.setVoice(B);
  expect(disconnect).not.toHaveBeenCalled();
  await workspace.setVoice(null);
  expect(disconnect).toHaveBeenCalledOnce();
  await workspace.setVoice(null);
  expect(disconnect).toHaveBeenCalledOnce();
  stop();
});
