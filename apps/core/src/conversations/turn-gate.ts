import { type Continuation, type FramedTurn, framed } from './turn-framing.js';
import type { TurnRequest } from './turn-request.js';

type GatedTurn = {
  readonly request: TurnRequest;
  readonly settled: Promise<void>;
  readonly confirmed: Promise<boolean>;
  confirm(): void;
  cancel(): Promise<void>;
};

export class TurnGate<Turn extends GatedTurn> {
  readonly unfinished = new Set<Turn>();
  current?: Turn;
  running?: Turn;
  latest?: Turn;
  private continuation?: Continuation;
  private confirmedWords?: string;

  frame(words: string): FramedTurn {
    const turn = framed(this.continuation, words);
    this.continuation = undefined;
    return turn;
  }

  admit(turn: Turn): void {
    this.unfinished.add(turn);
    void turn.settled.then(() => this.unfinished.delete(turn));
    this.current = turn;
    if (this.confirmedWords === turn.request.words) turn.confirm();
    this.confirmedWords = undefined;
  }

  started(turn: Turn): void {
    this.running = turn;
    this.latest = turn;
  }

  release(turn: Turn): void {
    if (this.running === turn) this.running = undefined;
  }

  confirm(words: string): void {
    if (this.current?.request.words === words) this.current.confirm();
    else this.confirmedWords = words;
  }

  async withdraw(): Promise<Turn | undefined> {
    const turn = this.current;
    if (!turn?.request.early) return undefined;
    this.continuation = { kind: 'withdrawn', words: turn.request.words };
    await turn.cancel();
    return turn;
  }

  async interrupt(heard: string): Promise<Turn | undefined> {
    this.continuation = { kind: 'interrupted', heard };
    await this.running?.cancel();
    return this.latest;
  }

  toolCallAllowed(): Promise<boolean> {
    return this.running?.confirmed ?? Promise.resolve(false);
  }
}
