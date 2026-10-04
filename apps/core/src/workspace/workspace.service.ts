import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { combineLatest, firstValueFrom, map, type Observable } from 'rxjs';
import { AgentService } from '../agent/agent.service.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { LayoutService } from '../layout/layout.service.js';
import { VoiceService } from '../voice/voice.service.js';
import {
  type AgentListing,
  type LayoutAction,
  type NewPane,
  type Pane,
  type PaneOpening,
  type PaneContent,
  type PaneView,
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
    @Inject(AgentService)
    private readonly agent: Pick<AgentService, 'launch'>,
  ) {}

  get changes(): Observable<WorkspaceView> {
    return combineLatest([
      this.layout.changes,
      this.conversations.workingChanges,
      this.voice.changes,
    ]).pipe(
      map(([{ layout, panes }, working, voiceAgentId]) => ({
        ...layout,
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

  openPane(pane: NewPane): Promise<Pane> {
    return this.layout.openPane(pane);
  }

  async open(id: string, opening: PaneOpening): Promise<Pane> {
    this.layout.openable(id, opening.kind);
    if (opening.kind === 'agent' && opening.launch) {
      await this.agent.launch(id, opening.launch);
    }
    return this.layout.open(id, opening.kind);
  }

  openConversation(conversationId: string, nextTo: string): Promise<Pane> {
    return this.layout.openNextTo(conversationId, nextTo);
  }

  act(action: LayoutAction): Promise<void> {
    return this.layout.act(action);
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
    const { panes } = await this.view();
    return {
      agents: panes.flatMap((pane) =>
        pane.kind === 'agent' ? [listedAgent(pane, callerId)] : [],
      ),
      otherPanes: panes.flatMap((pane) =>
        pane.kind === 'agent' ? [] : [pane],
      ),
      layout: this.layout.current.layout,
    };
  }
}

export const workspaceProvider = {
  provide: WORKSPACE,
  useExisting: WorkspaceService,
};
