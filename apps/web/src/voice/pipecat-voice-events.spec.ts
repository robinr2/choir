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

function transcribe(text: string, final: boolean): void {
  client.emit(RTVIEvent.UserTranscript, {
    text,
    final,
    timestamp: '',
    user_id: '',
  });
}

function say(text: string, segmentId: number): void {
  client.emit(RTVIEvent.BotOutput, { text, segment_id: segmentId });
}

beforeEach(() => {
  vi.clearAllMocks();
  events = new PipecatVoiceEvents(client, helpers);
  events.subscribe();
  return () => events.unsubscribe();
});

test('turns the final user transcript into a user turn', () => {
  transcribe('hello', false);
  transcribe('hello choir', true);
  expect(helpers.emitTranscript.mock.calls).toEqual([
    [{ role: 'user', text: 'hello choir', isFinal: true }],
  ]);
});

test('streams the reply sentence by sentence while the bot speaks', () => {
  client.emit(RTVIEvent.BotStartedSpeaking);
  say('Hello.', 1);
  say('Hello.', 1);
  say('How are you?', 2);
  expect(helpers.emitMode).toHaveBeenCalledWith('speaking');
  expect(helpers.emitTranscript.mock.calls).toEqual([
    [{ role: 'assistant', text: 'Hello.' }],
    [{ role: 'assistant', text: 'Hello.' }],
    [{ role: 'assistant', text: 'Hello. How are you?' }],
  ]);
});

test('finishes the reply when the bot stops speaking', () => {
  say('Hello.', 1);
  client.emit(RTVIEvent.BotStoppedSpeaking);
  say('Again.', 2);
  expect(helpers.emitMode).toHaveBeenCalledWith('listening');
  expect(helpers.emitTranscript.mock.calls.slice(1)).toEqual([
    [{ role: 'assistant', text: 'Hello.', isFinal: true }],
    [{ role: 'assistant', text: 'Again.' }],
  ]);
});

test('finishes no reply when the bot stops without having said anything', () => {
  client.emit(RTVIEvent.BotStoppedSpeaking);
  expect(helpers.emitMode).toHaveBeenCalledWith('listening');
  expect(helpers.emitTranscript).not.toHaveBeenCalled();
});

test('ends the session and stops listening when the client disconnects', () => {
  client.emit(RTVIEvent.Disconnected);
  transcribe('hello choir', true);
  expect(helpers.end).toHaveBeenCalledWith('finished');
  expect(helpers.emitTranscript).not.toHaveBeenCalled();
});

test('stops listening to every event once unsubscribed', () => {
  events.unsubscribe();
  transcribe('hello choir', true);
  say('Hello.', 1);
  client.emit(RTVIEvent.BotStartedSpeaking);
  client.emit(RTVIEvent.BotStoppedSpeaking);
  client.emit(RTVIEvent.Disconnected);
  expect(helpers.emitTranscript).not.toHaveBeenCalled();
  expect(helpers.emitMode).not.toHaveBeenCalled();
  expect(helpers.end).not.toHaveBeenCalled();
});
