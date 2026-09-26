import type { VoiceSessionHelpers } from '@assistant-ui/react';
import { RTVIEvent } from '@pipecat-ai/client-js';
import { beforeEach, expect, test, vi } from 'vitest';
import { createPipecatClient } from './create-pipecat-client';
import { PipecatVoiceEvents } from './pipecat-voice-events';

const client = createPipecatClient();

const helpers = {
  setStatus: vi.fn<VoiceSessionHelpers['setStatus']>(),
  end: vi.fn<VoiceSessionHelpers['end']>(),
  emitTranscript: vi.fn<VoiceSessionHelpers['emitTranscript']>(),
  emitMode: vi.fn<VoiceSessionHelpers['emitMode']>(),
  emitVolume: vi.fn<VoiceSessionHelpers['emitVolume']>(),
  isDisposed: vi.fn<VoiceSessionHelpers['isDisposed']>(),
} satisfies VoiceSessionHelpers;

let events: PipecatVoiceEvents;

beforeEach(() => {
  vi.clearAllMocks();
  events = new PipecatVoiceEvents(client, helpers);
  events.subscribe();
  return () => events.unsubscribe();
});

test('follows whether the bot speaks or listens', () => {
  client.emit(RTVIEvent.BotStartedSpeaking);
  client.emit(RTVIEvent.BotStoppedSpeaking);
  expect(helpers.emitMode.mock.calls).toEqual([['speaking'], ['listening']]);
});

test('leaves the transcript to the conversation', () => {
  client.emit(RTVIEvent.UserTranscript, {
    text: 'hello choir',
    final: true,
    timestamp: '',
    user_id: '',
  });
  client.emit(RTVIEvent.BotOutput, { text: 'Hello.', segment_id: 1 });
  expect(helpers.emitTranscript).not.toHaveBeenCalled();
});

test('ends the session and stops listening when the client disconnects', () => {
  client.emit(RTVIEvent.Disconnected);
  client.emit(RTVIEvent.BotStartedSpeaking);
  expect(helpers.end).toHaveBeenCalledWith('finished');
  expect(helpers.emitMode).not.toHaveBeenCalled();
});

test('stops listening to every event once unsubscribed', () => {
  events.unsubscribe();
  client.emit(RTVIEvent.BotStartedSpeaking);
  client.emit(RTVIEvent.BotStoppedSpeaking);
  client.emit(RTVIEvent.Disconnected);
  expect(helpers.emitMode).not.toHaveBeenCalled();
  expect(helpers.end).not.toHaveBeenCalled();
});
