import type { SessionUpdate } from '@agentclientprotocol/sdk';
import { randomUUID } from 'node:crypto';
import { lastValueFrom, ReplaySubject, tap } from 'rxjs';
import type { AgentTurn } from '../agent/prompt-turn.js';
import type { PromptContent } from '../agent/session-content.js';
import type { TurnRequest } from './turn-request.js';
import { describeUsage, turnUsage } from './turn-usage.js';

function answerText(update: SessionUpdate): string[] {
  return update.sessionUpdate === 'agent_message_chunk' &&
    update.content.type === 'text'
    ? [update.content.text]
    : [];
}

export class ConversationTurn {
  readonly id = randomUUID();
  readonly answer = new ReplaySubject<string>();
  private readonly confirmation = Promise.withResolvers<boolean>();
  private readonly done = Promise.withResolvers<void>();
  private agentTurn?: AgentTurn;

  constructor(
    readonly request: TurnRequest,
    private readonly withdrawn: (turn: ConversationTurn) => void,
  ) {
    if (!request.early) this.confirmation.resolve(true);
  }

  get content(): PromptContent {
    const { prompt, images } = this.request;
    return { text: prompt, ...(images && { images }) };
  }

  get settled(): Promise<void> {
    return this.done.promise;
  }

  get confirmed(): Promise<boolean> {
    return this.confirmation.promise;
  }

  confirm(): void {
    this.confirmation.resolve(true);
  }

  async cancel(): Promise<void> {
    this.confirmation.resolve(false);
    if (this.agentTurn) await this.agentTurn.cancel();
    else this.withdraw();
  }

  withdraw(): void {
    this.withdrawn(this);
    this.finish();
  }

  async run(agentTurn: AgentTurn): Promise<string> {
    this.agentTurn = agentTurn;
    try {
      await lastValueFrom(
        agentTurn.updates.pipe(
          tap((update) => {
            for (const text of answerText(update)) this.answer.next(text);
          }),
        ),
        { defaultValue: undefined },
      );
      const result = await agentTurn.result;
      return `${result.stopReason}: ${describeUsage(turnUsage(result))}`;
    } finally {
      this.finish();
    }
  }

  private finish(): void {
    this.answer.complete();
    this.confirmation.resolve(false);
    this.done.resolve();
  }
}
