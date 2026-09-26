import type { TranscriptMessage } from '@/conversation/transcript';

export type Transcript = { text: string; final: boolean };

function userTurnsIn(messages: readonly TranscriptMessage[]): number {
  return messages.filter(({ role }) => role === 'user').length;
}

export class LiveTranscript {
  readonly #show: (text: string) => void;
  #committed = '';
  #userTurns?: number;

  constructor(show: (text: string) => void) {
    this.#show = show;
  }

  heard({ text, final }: Transcript): void {
    const shown = [this.#committed, text].filter(Boolean).join(' ');
    if (final) this.#committed = shown;
    this.#show(shown);
  }

  saw(messages: readonly TranscriptMessage[]): void {
    const userTurns = userTurnsIn(messages);
    if (userTurns === this.#userTurns) return;
    this.#userTurns = userTurns;
    this.#committed = '';
    this.#show('');
  }
}
