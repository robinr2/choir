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
  type AgentListing,
  type Edge,
  type LayoutNode,
  type NewPane,
  type OpenableKind,
  type Pane,
  type PaneContent,
  type PaneView,
  type SplitKind,
  WORKSPACE,
  type Workspace,
  type WorkspaceView,
} from './workspace.port.js';

function paneView(
  id: string,
  content: PaneContent,
  working: ReadonlySet<string>,
): PaneView {
  if (content.kind !== 'agent') return { id, ...content };
  return { id, ...content, working: working.has(id) };
}

function listedAgent(
  { id, name, working }: Extract<PaneView, { kind: 'agent' }>,
  callerId: string,
): AgentListing['agents'][number] {
  return {
    id,
    name,
    status: working ? 'working' : 'idle',
    you: id === callerId,
  };
}

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
      map(([{ layout, panes }, working, voiceAgentId]) => ({
        layout,
        panes: Object.entries(panes).map(([id, content]) =>
          paneView(id, content, working),
        ),
        voiceAgentId,
      })),
    );
  }

  view(): Promise<WorkspaceView> {
    return firstValueFrom(this.changes);
  }

  split(id: string, kind: SplitKind, pane: NewPane): Promise<Pane> {
    return this.layout.split(id, kind, pane);
  }

  addAtEdge(edge: Edge, pane: NewPane): Promise<Pane> {
    return this.layout.addAtEdge(edge, pane);
  }

  open(id: string, kind: OpenableKind): Promise<Pane> {
    return this.layout.open(id, kind);
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
    const { layout, panes } = await this.view();
    return {
      agents: panes.flatMap((pane) =>
        pane.kind === 'agent' ? [listedAgent(pane, callerId)] : [],
      ),
      otherPanes: panes.flatMap((pane) =>
        pane.kind === 'agent' ? [] : [pane],
      ),
      layout,
    };
  }
}

export const workspaceProvider = {
  provide: WORKSPACE,
  useExisting: WorkspaceService,
};
