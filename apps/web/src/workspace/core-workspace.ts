import { type Feed, LiveStore, send } from '@/lib/live-store';

export type Height = { auto: number } | { fixed: number };

type Tile = { paneId: string; height: Height };

export type Column = {
  id: string;
  width: number;
  fullWidth: boolean;
  activeTile: number;
  tiles: readonly Tile[];
};

export type StripLayout = {
  id: string;
  columns: readonly Column[];
  activeColumn: number;
  restoresPrevious: boolean;
};

export type AgentView = {
  id: string;
  kind: 'agent';
  name: string;
  working: boolean;
};

export type PaneView =
  | { id: string; kind: 'empty' }
  | AgentView
  | { id: string; kind: 'excalidraw' };

export type Launch =
  | { cwd: string; model?: string; effort?: string; mode?: string }
  | { resume: string; cwd: string; fork?: boolean };

export type WorkspaceView = {
  loaded: boolean;
  workspaces: readonly StripLayout[];
  activeWorkspace: number;
  panes: readonly PaneView[];
  voiceAgentId: string | null;
};

export type SimpleAction =
  | 'focusColumnLeft'
  | 'focusColumnRight'
  | 'focusWindowUp'
  | 'focusWindowDown'
  | 'moveColumnLeft'
  | 'moveColumnRight'
  | 'moveWindowUp'
  | 'moveWindowDown'
  | 'consumeOrExpelWindowLeft'
  | 'consumeOrExpelWindowRight'
  | 'consumeWindowIntoColumn'
  | 'expelWindowFromColumn'
  | 'resetWindowHeight'
  | 'maximizeColumn'
  | 'focusWorkspaceUp'
  | 'focusWorkspaceDown'
  | 'moveWindowToWorkspaceUp'
  | 'moveWindowToWorkspaceDown'
  | 'moveColumnToWorkspaceUp'
  | 'moveColumnToWorkspaceDown'
  | 'moveWorkspaceUp'
  | 'moveWorkspaceDown';

export type LayoutAction =
  | { action: SimpleAction }
  | { action: 'setColumnWidth' | 'setWindowHeight'; change: number }
  | { action: 'expandColumnToAvailableWidth'; visibleColumns: string[] }
  | { action: 'focusPane'; paneId: string }
  | { action: 'focusColumn'; columnId: string }
  | { action: 'focusWorkspace'; workspaceId: string }
  | { action: 'movePane'; paneId: string; column: number; tile?: number }
  | { action: 'resizePane'; paneId: string; width?: number; height?: number };

const PATH = '/workspace';

export function agentOf(view: WorkspaceView, id: string): AgentView | null {
  const pane = view.panes.find((candidate) => candidate.id === id);
  return pane?.kind === 'agent' ? pane : null;
}

export class CoreWorkspace extends LiveStore<WorkspaceView> {
  #acting: Promise<unknown> = Promise.resolve();

  constructor(feed: Feed) {
    super(feed, {
      loaded: false,
      workspaces: [],
      activeWorkspace: 0,
      panes: [],
      voiceAgentId: null,
    });
  }

  async openPane(): Promise<void> {
    await send('POST', `${PATH}/panes`);
  }

  async openConversation(
    conversationId: string,
    nextTo: string,
  ): Promise<void> {
    await send('POST', `${PATH}/panes`, { conversationId, nextTo });
  }

  async openCanvas(paneId: string): Promise<void> {
    await send('PUT', `${PATH}/panes/${paneId}/content`, {
      kind: 'excalidraw',
    });
  }

  async launch(paneId: string, launch: Launch): Promise<void> {
    await send('PUT', `${PATH}/panes/${paneId}/content`, {
      kind: 'agent',
      launch,
    });
  }

  async act(action: LayoutAction): Promise<void> {
    const sent = () => send('POST', `${PATH}/actions`, action);
    const acting = this.#acting.then(sent, sent);
    this.#acting = acting;
    await acting;
  }

  async rename(id: string, name: string): Promise<void> {
    await send('PATCH', `${PATH}/panes/${id}`, { name });
  }

  async close(id: string): Promise<void> {
    await send('DELETE', `${PATH}/panes/${id}`);
  }

  async setVoice(agentId: string | null): Promise<void> {
    this.update({ voiceAgentId: agentId });
    await send('PUT', `${PATH}/voice`, { agentId });
  }

  protected receive(view: Omit<WorkspaceView, 'loaded'>): void {
    this.update({ ...view, loaded: true });
  }
}
