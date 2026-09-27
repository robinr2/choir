import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AcpRuntimeHandle,
  AcpRuntimeTurn,
  AcpSessionRecord,
} from 'acpx/runtime';
import { from, type Observable, switchMap } from 'rxjs';
import { AgentService } from '../agent/agent.service.js';
import { ProfileService } from '../agent/profile.service.js';
import { VoiceService } from '../voice/voice.service.js';
import { type Conversation, newConversation } from './conversation.js';
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
} from './transcript.js';
import { contextFor, fromAgent } from './turn-framing.js';
import { TurnMarksService } from './turn-marks.service.js';
import { WorkingAgents } from './working-agents.js';

export type ConversationAgent = {
  open(conversationId: string): Promise<AcpRuntimeHandle>;
  record(handle: AcpRuntimeHandle): Promise<Pick<AcpSessionRecord, 'messages'>>;
  startTurn(handle: AcpRuntimeHandle, text: string): AcpRuntimeTurn;
  close(handle: AcpRuntimeHandle): Promise<void>;
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
    @Inject(ProfileService)
    private readonly profile: Pick<ProfileService, 'voicePrompt'>,
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
    const framed = conversation.gate.frame(words);
    const aloud = voice || this.voice.isActive(id);
    const mark = { ...(voice && { voice }), ...(aloud && { aloud }) } as const;
    return this.start(conversation, handle, { ...framed, words, early, mark });
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

  async withdraw(id: string): Promise<void> {
    const conversation = this.conversation(id);
    const turn = await conversation.gate.withdraw();
    await this.markHeard(conversation, turn, '');
  }

  async interrupt(id: string, heard: string): Promise<void> {
    const conversation = this.conversation(id);
    const turn = await conversation.gate.interrupt(heard);
    await this.markHeard(conversation, turn, heard);
  }

  async promptContext(id: string, prompt: string): Promise<string> {
    const { gate } = this.conversation(id);
    const rules = await this.profile.voicePrompt();
    return contextFor(gate.unfinished, prompt, rules);
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
    const conversation = newConversation(id);
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
    this.working.follow(conversation.id, turn.settled);
    const { prompt, mark } = turn.request;
    if (Object.keys(mark).length === 0) return;
    conversation.marks.set(prompt, mark);
    await this.turnMarks.save(conversation.id, conversation.marks);
  }

  private async markHeard(
    conversation: Conversation,
    turn: ConversationTurn | undefined,
    heard: string,
  ): Promise<void> {
    if (!turn?.request.mark.aloud) return;
    const { prompt, mark } = turn.request;
    conversation.marks.set(prompt, { ...mark, heard });
    await this.turnMarks.save(conversation.id, conversation.marks);
    this.publish(conversation);
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
