import type { BotOutputData } from '@pipecat-ai/client-js';
import { type TranscriptMessage, userTurnsIn } from '@/conversation/transcript';

export type ReplySpeech = { live: boolean; spoken: string };

export class SpokenReply {
  #snapshot: ReplySpeech = { live: false, spoken: '' };
  #userTurns?: number;
  readonly #segments = new Map<number, string>();
  readonly #listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): ReplySpeech => this.#snapshot;

  restart(): void {
    this.#userTurns = undefined;
    this.#show({ live: false, spoken: '' });
  }

  saw(messages: readonly TranscriptMessage[]): void {
    const userTurns = userTurnsIn(messages);
    if (userTurns === this.#userTurns) return;
    const live = this.#userTurns !== undefined;
    this.#userTurns = userTurns;
    this.#segments.clear();
    this.#show({ live, spoken: '' });
  }

  heard({ segment_id, spoken_progress }: BotOutputData): void {
    if (!this.#snapshot.live || !spoken_progress || segment_id === undefined) {
      return;
    }
    this.#segments.set(segment_id, spoken_progress.accumulated_text);
    const spoken = [...this.#segments.values()].filter(Boolean).join(' ');
    this.#show({ live: true, spoken });
  }

  #show(snapshot: ReplySpeech): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}
