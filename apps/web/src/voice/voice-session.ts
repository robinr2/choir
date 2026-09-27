import type { PipecatClient } from '@pipecat-ai/client-js';
import type { CoreWorkspace } from '@/workspace/core-workspace';

const OFFER_URL = '/api/offer';

export class VoiceSession {
  readonly #client: PipecatClient;
  readonly #workspace: CoreWorkspace;
  #connected = false;

  constructor(client: PipecatClient, workspace: CoreWorkspace) {
    this.#client = client;
    this.#workspace = workspace;
  }

  async toggle(agentId: string): Promise<void> {
    if (this.#workspace.getSnapshot().voiceAgentId === agentId) {
      await this.#workspace.setVoice(null);
      await this.#disconnect();
      return;
    }
    await this.#workspace.setVoice(agentId);
    if (!this.#connected) await this.#connect();
  }

  readonly follow = (): (() => void) =>
    this.#workspace.subscribe(() => {
      if (this.#workspace.getSnapshot().voiceAgentId === null) {
        void this.#disconnect();
      }
    });

  async #connect(): Promise<void> {
    this.#connected = true;
    try {
      await this.#client.connect({
        webrtcRequestParams: { endpoint: OFFER_URL },
      });
    } catch {
      this.#connected = false;
      await this.#workspace.setVoice(null);
    }
  }

  async #disconnect(): Promise<void> {
    if (!this.#connected) return;
    this.#connected = false;
    await this.#client.disconnect();
  }
}
