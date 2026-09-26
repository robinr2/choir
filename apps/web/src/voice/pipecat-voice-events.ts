import type { VoiceSessionHelpers } from '@assistant-ui/react';
import {
  type BotOutputData,
  type PipecatClient,
  RTVIEvent,
  type TranscriptData,
} from '@pipecat-ai/client-js';

export class PipecatVoiceEvents {
  readonly #client: PipecatClient;
  readonly #helpers: VoiceSessionHelpers;
  readonly #replySegments = new Map<number | undefined, string>();

  constructor(client: PipecatClient, helpers: VoiceSessionHelpers) {
    this.#client = client;
    this.#helpers = helpers;
  }

  subscribe(): void {
    this.#client.on(RTVIEvent.UserTranscript, this.#onUserTranscript);
    this.#client.on(RTVIEvent.BotOutput, this.#onBotOutput);
    this.#client.on(RTVIEvent.BotStartedSpeaking, this.#onBotStartedSpeaking);
    this.#client.on(RTVIEvent.BotStoppedSpeaking, this.#onBotStoppedSpeaking);
    this.#client.on(RTVIEvent.Disconnected, this.#onDisconnected);
  }

  unsubscribe(): void {
    this.#client.off(RTVIEvent.UserTranscript, this.#onUserTranscript);
    this.#client.off(RTVIEvent.BotOutput, this.#onBotOutput);
    this.#client.off(RTVIEvent.BotStartedSpeaking, this.#onBotStartedSpeaking);
    this.#client.off(RTVIEvent.BotStoppedSpeaking, this.#onBotStoppedSpeaking);
    this.#client.off(RTVIEvent.Disconnected, this.#onDisconnected);
  }

  #reply(): string {
    return [...this.#replySegments.values()].join(' ');
  }

  readonly #onUserTranscript = ({ text, final }: TranscriptData): void => {
    if (final) {
      this.#helpers.emitTranscript({ role: 'user', text, isFinal: true });
    }
  };

  readonly #onBotOutput = ({ text, segment_id }: BotOutputData): void => {
    this.#replySegments.set(segment_id, text);
    this.#helpers.emitTranscript({ role: 'assistant', text: this.#reply() });
  };

  readonly #onBotStartedSpeaking = (): void => {
    this.#helpers.emitMode('speaking');
  };

  readonly #onBotStoppedSpeaking = (): void => {
    this.#helpers.emitMode('listening');
    if (this.#replySegments.size === 0) return;
    this.#helpers.emitTranscript({
      role: 'assistant',
      text: this.#reply(),
      isFinal: true,
    });
    this.#replySegments.clear();
  };

  readonly #onDisconnected = (): void => {
    this.unsubscribe();
    this.#helpers.end('finished');
  };
}
