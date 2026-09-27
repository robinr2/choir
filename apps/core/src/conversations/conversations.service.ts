import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AcpRuntimeHandle,
  AcpRuntimeTurn,
  AcpSessionRecord,
} from 'acpx/runtime';
import { BehaviorSubject, from, type Observable, switchMap } from 'rxjs';
import { AgentService } from '../agent/agent.service.js';
import { VoiceService } from '../voice/voice.service.js';
import {
  ConversationTurn,
  type TurnKind,
  type TurnRequest,
} from './conversation-turn.js';
import {
  liveMessages,
  type Sender,
  type TranscriptMessage,
  transcriptOf,
  type TurnMark,
} from './transcript.js';
import { fromAgent } from './turn-framing.js';
import { TurnGate } from './turn-gate.js';
import { TurnMarksService } from './turn-marks.service.js';
import { WorkingAgents } from './working-agents.js';

export type ConversationAgent = {
  open(conversationId: string): Promise<AcpRuntimeHandle>;
  record(handle: AcpRuntimeHandle): Promise<Pick<AcpSessionRecord, 'messages'>>;
  startTurn(handle: AcpRuntimeHandle, text: string): AcpRuntimeTurn;
  close(handle: AcpRuntimeHandle): Promise<void>;
};

type Conversation = {
  id: string;
  snapshot: BehaviorSubject<TranscriptMessage[]>;
  record: Pick<AcpSessionRecord, 'messages'>;
  marks: Map<string, TurnMark>;
  unfinished: Set<ConversationTurn>;
  gate: TurnGate;
  opened?: Promise<AcpRuntimeHandle>;
};

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);
  private readonly conversations = new Map<string, Conversation>();
  private readonly working = new WorkingAgents();

  constructor(
    @Inject(AgentService) private readonly agent: ConversationAgent,
    @Inject(TurnMarksService)
    private readonly turnMarks: Pick<TurnMarksService, 'load' | 'save'>,
    @Inject(VoiceService)
    private readonly voice: Pick<VoiceService, 'isActive' | 'speak'>,
  ) {}

  get workingChanges(): Observable<ReadonlySet<string>> {
    return this.working.changes;
  }

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
    { early, voice }: TurnKind,
  ): Promise<Observable<string>> {
    const conversation = this.conversation(id);
    const handle = await this.handle(conversation);
    const prompt = conversation.gate.frame(words);
    const aloud = voice || this.voice.isActive(id);
    const mark = { ...(voice && { voice }), ...(aloud && { aloud }) } as const;
    return this.start(conversation, handle, { prompt, words, early, mark });
  }

  async sendMessage(id: string, text: string, sender: Sender): Promise<void> {
    const conversation = this.conversation(id);
    const handle = await this.handle(conversation);
    const aloud = this.voice.isActive(id);
    const mark = { from: sender, text, ...(aloud && { aloud }) } as const;
    const prompt = fromAgent(sender, text);
    const request = { prompt, words: prompt, early: false, mark };
    await this.start(conversation, handle, request);
  }

  confirm(id: string, words: string): void {
    this.conversation(id).gate.confirm(words);
  }

  withdraw(id: string): Promise<void> {
    return this.conversation(id).gate.withdraw();
  }

  interrupt(id: string, heard: string): Promise<void> {
    return this.conversation(id).gate.interrupt(heard);
  }

  isVoiceTurn(id: string, prompt: string): boolean {
    const { unfinished } = this.conversation(id);
    return [...unfinished].some(
      ({ request }) => request.mark.aloud && request.prompt === prompt.trim(),
    );
  }

  toolCallAllowed(id: string): Promise<boolean> {
    return this.conversation(id).gate.toolCallAllowed();
  }

  async close(id: string): Promise<void> {
    const conversation = this.conversations.get(id);
    if (!conversation) return;
    this.conversations.delete(id);
    this.working.forget(id);
    conversation.snapshot.complete();
    const handle = await conversation.opened;
    if (handle) await this.agent.close(handle);
  }

  private conversation(id: string): Conversation {
    const existing = this.conversations.get(id);
    if (existing) return existing;
    const conversation: Conversation = {
      id,
      snapshot: new BehaviorSubject<TranscriptMessage[]>([]),
      record: { messages: [] },
      marks: new Map(),
      unfinished: new Set(),
      gate: new TurnGate(),
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
    conversation.marks = await this.turnMarks.load(conversation.id);
    await this.reload(conversation, handle);
    return handle;
  }

  private async start(
    conversation: Conversation,
    handle: AcpRuntimeHandle,
    request: TurnRequest,
  ): Promise<Observable<string>> {
    const turn = new ConversationTurn(
      this.agent.startTurn(handle, request.prompt),
      request,
      () => this.publish(conversation),
    );
    await this.track(conversation, turn);
    this.publish(conversation);
    void this.finish(conversation, handle, turn).catch((error: unknown) => {
      this.logger.error(
        `Conversation ${conversation.id} turn failed: ${String(error)}`,
      );
    });
    const { voice, aloud } = request.mark;
    if (aloud && !voice) this.voice.speak(conversation.id, turn.answer);
    return turn.answer.asObservable();
  }

  private async track(
    conversation: Conversation,
    turn: ConversationTurn,
  ): Promise<void> {
    conversation.gate.admit(turn);
    conversation.unfinished.add(turn);
    this.working.follow(conversation.id, turn.settled);
    void turn.settled.then(() => conversation.unfinished.delete(turn));
    const { prompt, mark } = turn.request;
    if (Object.keys(mark).length === 0) return;
    conversation.marks.set(prompt, mark);
    await this.turnMarks.save(conversation.id, conversation.marks);
  }

  private async reload(
    conversation: Conversation,
    handle: AcpRuntimeHandle,
  ): Promise<void> {
    conversation.record = await this.agent.record(handle);
    this.publish(conversation);
  }

  private publish({ snapshot, record, marks, gate }: Conversation): void {
    const { current } = gate;
    const index = record.messages.length;
    const live = current
      ? liveMessages(current.request, current.parts, index)
      : [];
    snapshot.next([...transcriptOf(record, marks), ...live]);
  }

  private async finish(
    conversation: Conversation,
    handle: AcpRuntimeHandle,
    turn: ConversationTurn,
  ): Promise<void> {
    const summary = await turn.run();
    this.logger.log(`Conversation ${conversation.id} turn ${summary}`);
    conversation.gate.release(turn);
    await this.reload(conversation, handle);
  }
}
