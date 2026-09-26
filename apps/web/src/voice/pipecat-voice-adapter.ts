import {
  createVoiceSession,
  type RealtimeVoiceAdapter,
  type VoiceSessionControls,
  type VoiceSessionHelpers,
} from '@assistant-ui/react';
import type { PipecatClient } from '@pipecat-ai/client-js';
import { PipecatVoiceEvents } from './pipecat-voice-events';

const OFFER_URL = '/api/offer';

export class PipecatVoiceAdapter implements RealtimeVoiceAdapter {
  readonly #client: PipecatClient;

  constructor(client: PipecatClient) {
    this.#client = client;
  }

  connect(options: {
    abortSignal?: AbortSignal;
  }): RealtimeVoiceAdapter.Session {
    return createVoiceSession(options, (helpers) => this.#start(helpers));
  }

  async #start(helpers: VoiceSessionHelpers): Promise<VoiceSessionControls> {
    const client = this.#client;
    const events = new PipecatVoiceEvents(client, helpers);
    events.subscribe();
    try {
      await client.connect({ webrtcRequestParams: { endpoint: OFFER_URL } });
    } catch (error) {
      events.unsubscribe();
      throw error;
    }
    helpers.setStatus({ type: 'running' });
    return {
      disconnect: () => {
        events.unsubscribe();
        void client.disconnect();
      },
      mute: () => client.enableMic(false),
      unmute: () => client.enableMic(true),
      sendText: (text) => client.sendText(text),
    };
  }
}
