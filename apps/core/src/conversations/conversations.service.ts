import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AcpRuntimeHandle,
  AcpRuntimeTurn,
  AcpSessionRecord,
} from 'acpx/runtime';
import { BehaviorSubject, from, type Observable, switchMap } from 'rxjs';
import { AgentService } from '../agent/agent.service.js';
import { ConversationTurn, type TurnKind } from './conversation-turn.js';
import { type TranscriptMessage, transcriptOf } from './transcript.js';
import { type Continuation, framed } from './turn-framing.js';
import { VoiceTurnsService } from './voice-turns.service.js';

export type ConversationAgent = {
  open(conversationId: string): Promise<AcpRuntimeHandle>;
  record(handle: AcpRuntimeHandle): Promise<Pick<AcpSessionRecord, 'messages'>>;
  startTurn(handle: AcpRuntimeHandle, text: string): AcpRuntimeTurn;
};

type Conversation = {
  id: string;
  snapshot: BehaviorSubject<TranscriptMessage[]>;
  history: TranscriptMessage[];
  nextIndex: number;
  opened?: Promise<AcpRuntimeHandle>;
  current?: ConversationTurn;
  unfinished: Set<ConversationTurn>;
  voicePrompts: Set<string>;
  continuation?: Continuation;
  confirmedWords?: string;
};

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);
  private readonly conversations = new Map<string, Conversation>();

  constructor(
    @Inject(AgentService) private readonly agent: ConversationAgent,
    @Inject(VoiceTurnsService)
    private readonly voiceTurns: Pick<VoiceTurnsService, 'load' | 'save'>,
  ) {}

  async messages(id: string): Promise<TranscriptMessage[]> {
    const conversation = this.conversation(id);
    await this.handle(conversation);
    return conversation.snapshot.value;
  }

  updates(id: string): Observable<TranscriptMessage[]> {
    const conversation = this.conversation(id);
    return from(this.handle(conversation)).pipe(
      switchMap(() => conversation.snapshot),
    );
  }

  async addUserTurn(
    id: string,
    words: string,
    kind: TurnKind,
  ): Promise<Observable<string>> {
    const conversation = this.conversation(id);
    const handle = await this.handle(conversation);
    const prompt = framed(conversation.continuation, words);
    conversation.continuation = undefined;
    const turn = new ConversationTurn(
      this.agent.startTurn(handle, prompt),
      { prompt, words, ...kind },
      () => this.publish(conversation),
    );
    await this.track(conversation, turn);
    this.publish(conversation);
    void this.finish(conversation, handle, turn).catch((error: unknown) => {
      this.logger.error(`Conversation ${id} turn failed: ${String(error)}`);
    });
    return turn.answer.asObservable();
  }

  confirm(id: string, words: string): void {
    const conversation = this.conversation(id);
    const turn = conversation.current;
    if (turn?.request.words === words) turn.confirm();
    else conversation.confirmedWords = words;
  }

  async withdraw(id: string): Promise<void> {
    const conversation = this.conversation(id);
    const turn = conversation.current;
    if (!turn?.request.early) return;
    conversation.continuation = {
      kind: 'withdrawn',
      words: turn.request.words,
    };
    await turn.cancel();
  }

  async interrupt(id: string, heard: string): Promise<void> {
    const conversation = this.conversation(id);
    conversation.continuation = { kind: 'interrupted', heard };
    await conversation.current?.cancel();
  }

  isVoiceTurn(id: string, prompt: string): boolean {
    const { unfinished } = this.conversation(id);
    return [...unfinished].some(
      ({ request }) => request.voice && request.prompt === prompt.trim(),
    );
  }

  toolCallAllowed(id: string): Promise<boolean> {
    const turn = this.conversation(id).current;
    return turn?.confirmed ?? Promise.resolve(false);
  }

  private conversation(id: string): Conversation {
    const existing = this.conversations.get(id);
    if (existing) return existing;
    const conversation: Conversation = {
      id,
      snapshot: new BehaviorSubject<TranscriptMessage[]>([]),
      history: [],
      nextIndex: 0,
      unfinished: new Set(),
      voicePrompts: new Set(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  private handle(conversation: Conversation): Promise<AcpRuntimeHandle> {
    conversation.opened ??= this.open(conversation);
    return conversation.opened;
  }

  private async open(conversation: Conversation): Promise<AcpRuntimeHandle> {
    const handle = await this.agent.open(conversation.id);
    conversation.voicePrompts = await this.voiceTurns.load(conversation.id);
    await this.reload(conversation, handle);
    return handle;
  }

  private async reload(
    conversation: Conversation,
    handle: AcpRuntimeHandle,
  ): Promise<void> {
    const record = await this.agent.record(handle);
    conversation.history = transcriptOf(record, conversation.voicePrompts);
    conversation.nextIndex = record.messages.length;
    this.publish(conversation);
  }

  private publish(conversation: Conversation): void {
    conversation.snapshot.next([
      ...conversation.history,
      ...this.live(conversation),
    ]);
  }

  private live({ current, nextIndex }: Conversation): TranscriptMessage[] {
    if (!current) return [];
    const voice = current.request.voice ? { voice: true as const } : {};
    return [
      {
        id: `m${nextIndex}`,
        role: 'user',
        parts: [{ type: 'text', text: current.request.prompt }],
        ...voice,
      },
      {
        id: `m${nextIndex + 1}`,
        role: 'assistant',
        parts: current.parts,
        ...voice,
      },
    ];
  }

  private async track(
    conversation: Conversation,
    turn: ConversationTurn,
  ): Promise<void> {
    conversation.current = turn;
    conversation.unfinished.add(turn);
    if (conversation.confirmedWords === turn.request.words) turn.confirm();
    conversation.confirmedWords = undefined;
    if (!turn.request.voice) return;
    conversation.voicePrompts.add(turn.request.prompt);
    await this.voiceTurns.save(conversation.id, conversation.voicePrompts);
  }

  private async finish(
    conversation: Conversation,
    handle: AcpRuntimeHandle,
    turn: ConversationTurn,
  ): Promise<void> {
    const summary = await turn.run().finally(() => {
      conversation.unfinished.delete(turn);
    });
    this.logger.log(`Conversation ${conversation.id} turn ${summary}`);
    if (conversation.current === turn) conversation.current = undefined;
    await this.reload(conversation, handle);
  }
}
