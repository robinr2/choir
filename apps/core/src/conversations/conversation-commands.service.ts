import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EMPTY, type Observable } from 'rxjs';
import type { PromptContent } from '../agent/session-content.js';
import {
  type ChoirCommand,
  choirCommand,
  subtaskPrompt,
} from './choir-commands.js';
import { ConversationHostService } from './conversation-host.service.js';
import { CONVERSATIONS, type Conversations } from './conversations.port.js';
import { forkChanges } from './forks.js';
import type { TurnKind, TurnRequest } from './turn-request.js';

function typed(text: string): TurnRequest {
  return { prompt: text, words: text, early: false, mark: {} };
}

@Injectable()
export class ConversationCommandsService {
  constructor(
    @Inject(CONVERSATIONS)
    private readonly conversations: Pick<
      Conversations,
      | 'addUserTurn'
      | 'submit'
      | 'session'
      | 'switchSession'
      | 'changes'
      | 'followFork'
    >,
    @Inject(ConversationHostService)
    private readonly host: Pick<
      ConversationHostService,
      'fork' | 'sessions' | 'link'
    >,
  ) {}

  addUserTurn(
    id: string,
    content: PromptContent,
    kind: TurnKind,
  ): Promise<Observable<string>> {
    const command = choirCommand(content.text);
    if (!command) return this.conversations.addUserTurn(id, content, kind);
    return this.run(id, command, content.text);
  }

  private async run(
    id: string,
    { name, argument }: ChoirCommand,
    text: string,
  ): Promise<Observable<string>> {
    if (name === 'subtask') return this.subtask(id, argument, text);
    if (name === 'branch') await this.branch(id, argument);
    if (name === 'fork') await this.fork(id, argument);
    if (name === 'resume') await this.resume(id, argument);
    return EMPTY;
  }

  private subtask(
    id: string,
    task: string,
    text: string,
  ): Promise<Observable<string>> {
    if (!task) throw new BadRequestException('Name the task of the subtask');
    const prompt = subtaskPrompt(task);
    return this.conversations.submit(id, { ...typed(prompt), mark: { text } });
  }

  private async branch(id: string, name: string): Promise<void> {
    const session = await this.conversations.session(id);
    const branched = await this.host.fork(session.id, session.cwd);
    await this.conversations.switchSession(id, branched, session.cwd);
    if (name) await this.conversations.submit(id, typed(`/rename ${name}`));
  }

  private async fork(id: string, prompt: string): Promise<void> {
    const session = await this.conversations.session(id);
    const sessionId = await this.host.fork(session.id, session.cwd);
    const forkId = randomUUID();
    await this.host.link(forkId, sessionId, session.cwd);
    const seed = { id: forkId, sessionId, prompt, startedAt: Date.now() };
    const states = this.conversations.changes(forkId);
    this.conversations.followFork(id, forkChanges(seed, states));
    if (prompt) await this.conversations.submit(forkId, typed(prompt));
  }

  private async resume(id: string, sessionId: string): Promise<void> {
    if (!sessionId) throw new BadRequestException('Name the session to resume');
    const sessions = await this.host.sessions();
    const listing = sessions.find((session) => session.sessionId === sessionId);
    if (!listing) {
      throw new NotFoundException(`There is no session ${sessionId}`);
    }
    await this.conversations.switchSession(id, sessionId, listing.cwd);
  }
}
