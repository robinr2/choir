import type { ConversationTurn } from './conversation-turn.js';
import { type Continuation, framed } from './turn-framing.js';

export class TurnGate {
  current?: ConversationTurn;
  private continuation?: Continuation;
  private confirmedWords?: string;

  frame(words: string): string {
    const prompt = framed(this.continuation, words);
    this.continuation = undefined;
    return prompt;
  }

  admit(turn: ConversationTurn): void {
    this.current = turn;
    if (this.confirmedWords === turn.request.words) turn.confirm();
    this.confirmedWords = undefined;
  }

  release(turn: ConversationTurn): void {
    if (this.current === turn) this.current = undefined;
  }

  confirm(words: string): void {
    if (this.current?.request.words === words) this.current.confirm();
    else this.confirmedWords = words;
  }

  async withdraw(): Promise<void> {
    const turn = this.current;
    if (!turn?.request.early) return;
    this.continuation = { kind: 'withdrawn', words: turn.request.words };
    await turn.cancel();
  }

  async interrupt(heard: string): Promise<void> {
    this.continuation = { kind: 'interrupted', heard };
    await this.current?.cancel();
  }

  toolCallAllowed(): Promise<boolean> {
    return this.current?.confirmed ?? Promise.resolve(false);
  }
}
