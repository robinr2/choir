import { lastValueFrom, ReplaySubject, tap } from 'rxjs';
import type { AgentTurn } from '../agent/prompt-turn.js';
import {
  answerText,
  type TranscriptPart,
  type TurnMark,
  withEvent,
} from './transcript.js';
import { describeUsage, turnUsage } from './turn-usage.js';

export type TurnKind = {
  early: boolean;
  voice: boolean;
};

export type TurnRequest = {
  prompt: string;
  note?: string;
  words: string;
  early: boolean;
  mark: TurnMark;
};

export class ConversationTurn {
  readonly answer = new ReplaySubject<string>();
  private readonly confirmation = Promise.withResolvers<boolean>();
  readonly settled: Promise<void>;
  private currentParts: TranscriptPart[] = [];

  constructor(
    private readonly turn: AgentTurn,
    readonly request: TurnRequest,
    private readonly onChange: () => void,
  ) {
    if (!request.early) this.confirmation.resolve(true);
    this.settled = turn.result.then(
      () => undefined,
      () => undefined,
    );
  }

  get parts(): TranscriptPart[] {
    return this.currentParts;
  }

  get result(): AgentTurn['result'] {
    return this.turn.result;
  }

  get confirmed(): Promise<boolean> {
    return this.confirmation.promise;
  }

  confirm(): void {
    this.confirmation.resolve(true);
  }

  async cancel(): Promise<void> {
    this.confirmation.resolve(false);
    await this.turn.cancel();
  }

  async run(): Promise<string> {
    try {
      await lastValueFrom(
        this.turn.updates.pipe(
          tap((update) => {
            this.currentParts = withEvent(this.currentParts, update);
            this.onChange();
            const text = answerText(update);
            if (text !== undefined) this.answer.next(text);
          }),
        ),
        { defaultValue: undefined },
      );
      const result = await this.turn.result;
      return `${result?.stopReason ?? 'withdrawn'}: ${describeUsage(turnUsage(result))}`;
    } finally {
      this.answer.complete();
      this.confirmation.resolve(false);
    }
  }
}
