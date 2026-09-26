import type { RealtimeVoiceAdapter } from '@assistant-ui/react';
import { RTVIEvent } from '@pipecat-ai/client-js';
import { afterEach, expect, test, vi } from 'vitest';
import { createPipecatClient } from './create-pipecat-client';
import { PipecatVoiceAdapter } from './pipecat-voice-adapter';

const client = createPipecatClient();
const adapter = new PipecatVoiceAdapter(client);

function stubClient(connect = Promise.resolve({ version: '1.0.0' })) {
  return {
    connect: vi.spyOn(client, 'connect').mockReturnValue(connect),
    disconnect: vi.spyOn(client, 'disconnect').mockResolvedValue(),
    enableMic: vi.spyOn(client, 'enableMic').mockReturnValue(),
    sendText: vi.spyOn(client, 'sendText').mockResolvedValue(),
  };
}

async function running(session: RealtimeVoiceAdapter.Session) {
  await vi.waitFor(() => expect(session.status).toEqual({ type: 'running' }));
  return session;
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('connects to the voice app and runs once the bot is ready', async () => {
  const { connect } = stubClient();
  const session = await running(adapter.connect({}));
  expect(connect).toHaveBeenCalledWith({
    webrtcRequestParams: { endpoint: '/api/offer' },
  });
  session.disconnect();
});

test('passes what the bot hears into the session', async () => {
  stubClient();
  const session = await running(adapter.connect({}));
  const onTranscript =
    vi.fn<(transcript: RealtimeVoiceAdapter.TranscriptItem) => void>();
  session.onTranscript(onTranscript);
  client.emit(RTVIEvent.UserTranscript, {
    text: 'hello choir',
    final: true,
    timestamp: '',
    user_id: '',
  });
  expect(onTranscript).toHaveBeenCalledWith({
    role: 'user',
    text: 'hello choir',
    isFinal: true,
  });
  session.disconnect();
});

test('ends with the error and stops listening when connecting fails', async () => {
  const error = new Error('offer rejected');
  stubClient(Promise.reject(error));
  const session = adapter.connect({});
  await vi.waitFor(() =>
    expect(session.status).toEqual({ type: 'ended', reason: 'error', error }),
  );
  expect(client.listenerCount(RTVIEvent.UserTranscript)).toBe(0);
});

test('disconnects from the voice app and stops listening', async () => {
  const { disconnect } = stubClient();
  const session = await running(adapter.connect({}));
  session.disconnect();
  expect(disconnect).toHaveBeenCalled();
  expect(client.listenerCount(RTVIEvent.UserTranscript)).toBe(0);
});

test('mutes and unmutes the microphone', async () => {
  const { enableMic } = stubClient();
  const session = await running(adapter.connect({}));
  session.mute();
  session.unmute();
  expect(enableMic.mock.calls).toEqual([[false], [true]]);
  session.disconnect();
});

test('hands typed text to the bot', async () => {
  const { sendText } = stubClient();
  const session = await running(adapter.connect({}));
  await session.sendText?.('hello choir');
  expect(sendText).toHaveBeenCalledWith('hello choir');
  session.disconnect();
});
