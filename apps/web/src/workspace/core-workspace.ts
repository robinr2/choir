import type { MosaicNode } from 'react-mosaic-component';
import { LiveStore, send } from '@/lib/live-store';

export type Layout = MosaicNode<string> | null;

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

export type OpenableKind = 'agent' | 'excalidraw';

export type WorkspaceView = {
  loaded: boolean;
  layout: Layout;
  panes: readonly PaneView[];
  voiceAgentId: string | null;
};

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export type SplitKind = 'vertical' | 'horizontal';

const PATH = '/workspace';

export function agentOf(view: WorkspaceView, id: string): AgentView | null {
  const pane = view.panes.find((candidate) => candidate.id === id);
  return pane?.kind === 'agent' ? pane : null;
}

export class CoreWorkspace extends LiveStore<WorkspaceView> {
  constructor() {
    super(`${PATH}/events`, {
      loaded: false,
      layout: null,
      panes: [],
      voiceAgentId: null,
    });
  }

  async split(paneId: string, direction: SplitKind): Promise<void> {
    await send('POST', `${PATH}/splits`, { paneId, direction });
  }

  async addAtEdge(edge: Edge): Promise<void> {
    await send('POST', `${PATH}/edges`, { edge });
  }

  async open(paneId: string, kind: OpenableKind): Promise<void> {
    await send('PUT', `${PATH}/panes/${paneId}/content`, { kind });
  }

  async swap(first: string, second: string): Promise<void> {
    await send('POST', `${PATH}/swaps`, { first, second });
  }

  async resize(layout: Layout): Promise<void> {
    this.update({ layout });
    await send('PUT', `${PATH}/layout`, { layout });
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
