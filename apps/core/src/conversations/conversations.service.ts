import { Inject, Injectable } from '@nestjs/common';
import { from, type Observable, switchMap } from 'rxjs';
import { ProfileService } from '../agent/profile.service.js';
import { VoiceService } from '../voice/voice.service.js';
import { Conversation, type ConversationHost } from './conversation.js';
import { ConversationHostService } from './conversation-host.service.js';
import {
  type ConfigChange,
  type ConversationState,
  CONVERSATIONS,
  type Conversations,
  type Fork,
  type InteractionAnswer,
  type OpenSession,
  type PromptContent,
  type Reply,
  type Sender,
  type TurnKind,
  type TurnRequest,
} from './conversations.port.js';
import { contextFor, fromAgent } from './turn-framing.js';

@Injectable()
export class ConversationsService implements Conversations {
  private readonly conversations = new Map<string, Conversation>();

  constructor(
    @Inject(ConversationHostService)
    private readonly host: ConversationHost &
      Pick<ConversationHostService, 'workingChanges' | 'link' | 'forget'>,
    @Inject(VoiceService)
    private readonly voice: Pick<VoiceService, 'isActive' | 'speak'>,
    @Inject(ProfileService)
    private readonly profile: Pick<ProfileService, 'voicePrompt'>,
  ) {}

  get workingChanges(): Observable<ReadonlySet<string>> {
    return this.host.workingChanges;
  }

  async state(id: string): Promise<ConversationState> {
    const conversation = this.conversation(id);
    await conversation.ready();
    return conversation.state;
  }

  changes(id: string): Observable<ConversationState> {
    const conversation = this.conversation(id);
    return from(conversation.ready()).pipe(
      switchMap(() => conversation.changes),
    );
  }

  async session(id: string): Promise<OpenSession> {
    const { id: sessionId, cwd } = await this.conversation(id).ready();
    return { id: sessionId, cwd };
  }

  addUserTurn(
    id: string,
    { text, images }: PromptContent,
    { early, voice }: TurnKind,
  ): Promise<Observable<string>> {
    const { gate } = this.conversation(id).turns;
    const framed = gate.frame(text);
    const aloud = voice || this.voice.isActive(id);
    const mark = { ...(voice && { voice }), ...(aloud && { aloud }) } as const;
    return this.submit(id, { ...framed, words: text, early, mark, images });
  }

  async sendMessage(id: string, text: string, sender: Sender): Promise<void> {
    const aloud = this.voice.isActive(id);
    const mark = { from: sender, text, ...(aloud && { aloud }) } as const;
    const prompt = fromAgent(sender, text);
    await this.submit(id, { prompt, words: prompt, early: false, mark });
  }

  async submit(id: string, request: TurnRequest): Promise<Observable<string>> {
    const conversation = this.conversation(id);
    await conversation.ready();
    const turn = conversation.turns.submit(request);
    const { voice, aloud } = request.mark;
    if (aloud && !voice) this.voice.speak(id, turn.answer);
    return turn.answer.asObservable();
  }

  steer(id: string, content: PromptContent): Promise<void> {
    return this.conversation(id).turns.steer(content);
  }

  steerQueued(id: string, item: string): Promise<boolean> {
    return this.conversation(id).turns.steerQueued(item);
  }

  removeQueued(id: string, item: string): boolean {
    return this.conversation(id).turns.remove(item);
  }

  cancel(id: string): Promise<void> {
    return this.conversation(id).turns.cancel();
  }

  respond(
    id: string,
    interaction: string,
    answer: InteractionAnswer,
  ): Promise<Reply> {
    return this.conversation(id).respond(interaction, answer);
  }

  configure(id: string, change: ConfigChange): Promise<void> {
    return this.conversation(id).configure(change);
  }

  switchSession(id: string, sessionId: string, cwd: string): Promise<void> {
    return this.conversation(id).switchTo(() =>
      this.host.link(id, sessionId, cwd),
    );
  }

  followFork(id: string, forks: Observable<Fork>): void {
    this.conversation(id).follow(forks);
  }

  confirm(id: string, words: string): void {
    this.conversation(id).turns.gate.confirm(words);
  }

  async withdraw(id: string): Promise<void> {
    const conversation = this.conversation(id);
    const turn = await conversation.turns.gate.withdraw();
    await conversation.markHeard(turn?.request, '');
  }

  async interrupt(id: string, heard: string): Promise<void> {
    const conversation = this.conversation(id);
    const turn = await conversation.turns.gate.interrupt(heard);
    await conversation.markHeard(turn?.request, heard);
  }

  async promptContext(id: string, prompt: string): Promise<string> {
    const { gate } = this.conversation(id).turns;
    const rules = await this.profile.voicePrompt();
    return contextFor(gate.unfinished, prompt, rules);
  }

  toolCallAllowed(id: string): Promise<boolean> {
    return this.conversation(id).turns.gate.toolCallAllowed();
  }

  async close(id: string): Promise<void> {
    const conversation = this.conversations.get(id);
    if (!conversation) return;
    this.conversations.delete(id);
    this.host.forget(id);
    await conversation.close();
  }

  private conversation(id: string): Conversation {
    const existing = this.conversations.get(id);
    if (existing) return existing;
    const conversation = new Conversation(id, this.host);
    this.conversations.set(id, conversation);
    return conversation;
  }
}

export const conversationsProvider = {
  provide: CONVERSATIONS,
  useExisting: ConversationsService,
};
