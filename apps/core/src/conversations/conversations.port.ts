import type { Observable } from 'rxjs';
import type { SessionUpdate } from '@agentclientprotocol/sdk';
import type {
  Interaction,
  InteractionAnswer,
  InteractionEvent,
  InteractionReply,
} from '../agent/interactions.js';
import type { PromptContent } from '../agent/session-content.js';
import type { ConversationState, Fork } from './conversation-state.js';
import type { Sender, TurnMark } from './transcript.js';
import type { TurnKind, TurnRequest } from './turn-request.js';

export type {
  ConversationState,
  Fork,
  Interaction,
  InteractionAnswer,
  InteractionEvent,
  PromptContent,
  Sender,
  SessionUpdate,
  TurnKind,
  TurnMark,
  TurnRequest,
};

export const CONVERSATIONS = Symbol('Conversations');

export type Reply = InteractionReply | 'answered-before';

export type ConfigChange = { model?: string; effort?: string; mode?: string };

export type TurnOutcome = { summary: string } | { error: unknown };

export type OpenSession = { id: string; cwd: string };

export type Conversations = {
  readonly workingChanges: Observable<ReadonlySet<string>>;
  state(id: string): Promise<ConversationState>;
  changes(id: string): Observable<ConversationState>;
  session(id: string): Promise<OpenSession>;
  addUserTurn(
    id: string,
    content: PromptContent,
    kind: TurnKind,
  ): Promise<Observable<string>>;
  submit(id: string, request: TurnRequest): Promise<Observable<string>>;
  sendMessage(id: string, text: string, sender: Sender): Promise<void>;
  steer(id: string, content: PromptContent): Promise<void>;
  steerQueued(id: string, item: string): Promise<boolean>;
  removeQueued(id: string, item: string): boolean;
  cancel(id: string): Promise<void>;
  respond(
    id: string,
    interaction: string,
    answer: InteractionAnswer,
  ): Promise<Reply>;
  configure(id: string, change: ConfigChange): Promise<void>;
  switchSession(id: string, sessionId: string, cwd: string): Promise<void>;
  followFork(id: string, forks: Observable<Fork>): void;
  confirm(id: string, words: string): void;
  withdraw(id: string): Promise<void>;
  interrupt(id: string, heard: string): Promise<void>;
  promptContext(id: string, prompt: string): Promise<string>;
  toolCallAllowed(id: string): Promise<boolean>;
  close(id: string): Promise<void>;
};
