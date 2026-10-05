import type { SessionHandle } from '../agent/agent-session.js';
import { promptBlocks, type PromptContent } from '../agent/session-content.js';
import { ConversationTurn } from './conversation-turn.js';
import type { ModelStore } from './conversation-state.js';
import type { TurnOutcome, TurnRequest } from './conversations.port.js';
import { contentPart, withMessage } from './session-messages.js';
import { TurnGate } from './turn-gate.js';

export type TurnHost = {
  session(): Promise<SessionHandle>;
  saveMark(request: TurnRequest): Promise<void>;
  changed(): void;
  ended(outcome: TurnOutcome): void;
  follow(settled: Promise<void>): void;
};

function typed(content: PromptContent): TurnRequest {
  const { text, images } = content;
  return { prompt: text, words: text, early: false, mark: {}, images };
}

export class ConversationTurns {
  readonly gate = new TurnGate<ConversationTurn>();
  private queue: ConversationTurn[] = [];
  private readonly open = new Set<ConversationTurn>();
  private readonly steered = new WeakSet<ConversationTurn>();
  private blocking?: ConversationTurn;
  private lastFailed = false;

  constructor(
    private readonly view: ModelStore,
    private readonly host: TurnHost,
  ) {}

  get busy(): boolean {
    return this.open.size > 0;
  }

  get failed(): boolean {
    return this.lastFailed;
  }

  submit(request: TurnRequest): ConversationTurn {
    const turn = new ConversationTurn(request, (gone) => this.dequeue(gone));
    this.gate.admit(turn);
    this.queue.push(turn);
    this.next();
    return turn;
  }

  async steer(content: PromptContent): Promise<void> {
    if (!this.busy) {
      this.submit(typed(content));
      return;
    }
    this.shown(content, true);
    const session = await this.host.session();
    if (await session.steer(content)) return;
    this.steered.add(this.submit(typed(content)));
  }

  async steerQueued(id: string): Promise<boolean> {
    const turn = this.queue.find((queued) => queued.id === id);
    if (!turn) return false;
    turn.withdraw();
    await this.steer(turn.content);
    return true;
  }

  remove(id: string): boolean {
    const turn = this.queue.find((queued) => queued.id === id);
    turn?.withdraw();
    return turn !== undefined;
  }

  async cancel(): Promise<void> {
    if (this.busy) await (await this.host.session()).cancel();
  }

  held(): void {
    this.blocking = undefined;
    this.next();
  }

  private next(): void {
    const turn = this.blocking ? undefined : this.queue.shift();
    if (turn) this.begin(turn);
    this.publishQueue();
  }

  private begin(turn: ConversationTurn): void {
    this.blocking = turn;
    this.open.add(turn);
    this.gate.started(turn);
    this.host.follow(turn.settled);
    void this.dispatch(turn);
  }

  private async dispatch(turn: ConversationTurn): Promise<void> {
    try {
      const session = await this.host.session();
      await this.host.saveMark(turn.request);
      if (!this.steered.has(turn)) this.shown(turn.content, false);
      const summary = await turn.run(session.startTurn(turn.content));
      this.settle(turn, { summary });
    } catch (error) {
      turn.withdraw();
      this.settle(turn, { error });
    }
  }

  private settle(turn: ConversationTurn, outcome: TurnOutcome): void {
    this.open.delete(turn);
    this.gate.release(turn);
    if (this.gate.latest === turn) this.lastFailed = 'error' in outcome;
    if (this.blocking === turn) this.blocking = undefined;
    this.host.ended(outcome);
    this.next();
  }

  private shown(content: PromptContent, steered: boolean): void {
    const parts = promptBlocks(content).flatMap(contentPart);
    this.view.change((model) => ({
      ...model,
      messages: withMessage(model.messages, {
        role: 'user',
        parts,
        ...(steered && { steered: true }),
      }),
    }));
  }

  private dequeue(turn: ConversationTurn): void {
    this.queue = this.queue.filter((queued) => queued !== turn);
    this.publishQueue();
  }

  private publishQueue(): void {
    const queue = this.queue.map(({ id, request }) => ({
      id,
      text: request.mark.text ?? request.prompt,
      images: request.images?.length ?? 0,
    }));
    this.view.change((model) => ({ ...model, queue }));
    this.host.changed();
  }
}
