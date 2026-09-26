import type { VoiceSessionHelpers } from '@assistant-ui/react';
import { type PipecatClient, RTVIEvent } from '@pipecat-ai/client-js';

export class PipecatVoiceEvents {
  readonly #client: PipecatClient;
  readonly #helpers: VoiceSessionHelpers;

  constructor(client: PipecatClient, helpers: VoiceSessionHelpers) {
    this.#client = client;
    this.#helpers = helpers;
  }

  subscribe(): void {
    this.#client.on(RTVIEvent.BotStartedSpeaking, this.#onBotStartedSpeaking);
    this.#client.on(RTVIEvent.BotStoppedSpeaking, this.#onBotStoppedSpeaking);
    this.#client.on(RTVIEvent.Disconnected, this.#onDisconnected);
  }

  unsubscribe(): void {
    this.#client.off(RTVIEvent.BotStartedSpeaking, this.#onBotStartedSpeaking);
    this.#client.off(RTVIEvent.BotStoppedSpeaking, this.#onBotStoppedSpeaking);
    this.#client.off(RTVIEvent.Disconnected, this.#onDisconnected);
  }

  readonly #onBotStartedSpeaking = (): void => {
    this.#helpers.emitMode('speaking');
  };

  readonly #onBotStoppedSpeaking = (): void => {
    this.#helpers.emitMode('listening');
  };

  readonly #onDisconnected = (): void => {
    this.unsubscribe();
    this.#helpers.end('finished');
  };
}
