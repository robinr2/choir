import type {
  AcpRuntimeEvent,
  AcpRuntimeTurn,
  AcpRuntimeTurnResult,
} from 'acpx/runtime';
import { ReplaySubject } from 'rxjs';
import { answerText, type TranscriptPart, withEvent } from './transcript.js';

export type TurnKind = {
  early: boolean;
  voice: boolean;
};

export type TurnRequest = TurnKind & {
  prompt: string;
  words: string;
};

export class ConversationTurn {
  readonly answer = new ReplaySubject<string>();
  private readonly confirmation = Promise.withResolvers<boolean>();
  private currentParts: TranscriptPart[] = [];

  constructor(
    private readonly turn: AcpRuntimeTurn,
    readonly request: TurnRequest,
    private readonly onChange: () => void,
  ) {
    if (!request.early) this.confirmation.resolve(true);
  }

  get parts(): TranscriptPart[] {
    return this.currentParts;
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

  async run(): Promise<AcpRuntimeTurnResult> {
    try {
      for await (const event of this.turn.events) this.follow(event);
      return await this.turn.result;
    } finally {
      this.answer.complete();
      this.confirmation.resolve(false);
    }
  }

  private follow(event: AcpRuntimeEvent): void {
    this.currentParts = withEvent(this.currentParts, event);
    this.onChange();
    const text = answerText(event);
    if (text !== undefined) this.answer.next(text);
  }
}
