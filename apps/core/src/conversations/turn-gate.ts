import type { ConversationTurn } from './conversation-turn.js';
import { type Continuation, type FramedTurn, framed } from './turn-framing.js';

export class TurnGate {
  readonly unfinished = new Set<ConversationTurn>();
  current?: ConversationTurn;
  latest?: ConversationTurn;
  private continuation?: Continuation;
  private confirmedWords?: string;

  frame(words: string): FramedTurn {
    const turn = framed(this.continuation, words);
    this.continuation = undefined;
    return turn;
  }

  admit(turn: ConversationTurn): void {
    this.unfinished.add(turn);
    void turn.settled.then(() => this.unfinished.delete(turn));
    this.current = turn;
    this.latest = turn;
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

  async withdraw(): Promise<ConversationTurn | undefined> {
    const turn = this.current;
    if (!turn?.request.early) return undefined;
    this.continuation = { kind: 'withdrawn', words: turn.request.words };
    await turn.cancel();
    return turn;
  }

  async interrupt(heard: string): Promise<ConversationTurn | undefined> {
    this.continuation = { kind: 'interrupted', heard };
    await this.current?.cancel();
    return this.latest;
  }

  toolCallAllowed(): Promise<boolean> {
    return this.current?.confirmed ?? Promise.resolve(false);
  }
}
