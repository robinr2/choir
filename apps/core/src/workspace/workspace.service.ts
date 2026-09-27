import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { combineLatest, firstValueFrom, map, type Observable } from 'rxjs';
import { ConversationsService } from '../conversations/conversations.service.js';
import { LayoutService } from '../layout/layout.service.js';
import { VoiceService } from '../voice/voice.service.js';
import {
  type Agent,
  type AgentListing,
  type Edge,
  type LayoutNode,
  type SplitKind,
  WORKSPACE,
  type Workspace,
  type WorkspaceView,
} from './workspace.port.js';

@Injectable()
export class WorkspaceService implements Workspace {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    @Inject(LayoutService) private readonly layout: LayoutService,
    @Inject(ConversationsService)
    private readonly conversations: Pick<
      ConversationsService,
      'workingChanges' | 'sendMessage' | 'close'
    >,
    @Inject(VoiceService) private readonly voice: VoiceService,
  ) {}

  get changes(): Observable<WorkspaceView> {
    return combineLatest([
      this.layout.changes,
      this.conversations.workingChanges,
      this.voice.changes,
    ]).pipe(
      map(([{ layout, agents }, working, voiceAgentId]) => ({
        layout,
        agents: Object.entries(agents).map(([id, { name }]) => ({
          id,
          name,
          working: working.has(id),
        })),
        voiceAgentId,
      })),
    );
  }

  view(): Promise<WorkspaceView> {
    return firstValueFrom(this.changes);
  }

  split(id: string, kind: SplitKind, name?: string): Promise<Agent> {
    return this.layout.split(id, kind, name);
  }

  addAtEdge(edge: Edge, name?: string): Promise<Agent> {
    return this.layout.addAtEdge(edge, name);
  }

  swap(first: string, second: string): Promise<void> {
    return this.layout.swap(first, second);
  }

  resize(layout: LayoutNode | null): Promise<void> {
    return this.layout.resize(layout);
  }

  rename(id: string, name: string): Promise<void> {
    return this.layout.rename(id, name);
  }

  async close(id: string): Promise<void> {
    await this.layout.remove(id);
    if (this.voice.isActive(id)) this.voice.activate(null);
    await this.conversations.close(id);
  }

  activateVoice(agentId: string | null): void {
    if (agentId !== null) this.layout.agent(agentId);
    this.voice.activate(agentId);
  }

  sendMessage(fromId: string, toId: string, text: string): void {
    const from = this.layout.agent(fromId);
    this.layout.agent(toId);
    if (fromId === toId) {
      throw new BadRequestException('An agent cannot message itself');
    }
    void this.conversations
      .sendMessage(toId, text, from)
      .catch((error: unknown) => {
        this.logger.error(`Message to agent ${toId} failed: ${String(error)}`);
      });
  }

  async list(callerId: string): Promise<AgentListing> {
    const { layout, agents } = await this.view();
    return {
      agents: agents.map(({ id, name, working }) => ({
        id,
        name,
        status: working ? 'working' : 'idle',
        you: id === callerId,
      })),
      layout,
    };
  }
}

export const workspaceProvider = {
  provide: WORKSPACE,
  useExisting: WorkspaceService,
};
