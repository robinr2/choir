import type { MosaicNode } from 'react-mosaic-component';
import { LiveStore, send } from '@/lib/live-store';

export type Layout = MosaicNode<string> | null;

export type AgentView = { id: string; name: string; working: boolean };

export type WorkspaceView = {
  loaded: boolean;
  layout: Layout;
  agents: readonly AgentView[];
  voiceAgentId: string | null;
};

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export type SplitKind = 'vertical' | 'horizontal';

const PATH = '/workspace';

export class CoreWorkspace extends LiveStore<WorkspaceView> {
  constructor() {
    super(`${PATH}/events`, {
      loaded: false,
      layout: null,
      agents: [],
      voiceAgentId: null,
    });
  }

  async split(agentId: string, direction: SplitKind): Promise<void> {
    await send('POST', `${PATH}/splits`, { agentId, direction });
  }

  async addAtEdge(edge: Edge): Promise<void> {
    await send('POST', `${PATH}/edges`, { edge });
  }

  async swap(first: string, second: string): Promise<void> {
    await send('POST', `${PATH}/swaps`, { first, second });
  }

  async resize(layout: Layout): Promise<void> {
    this.update({ layout });
    await send('PUT', `${PATH}/layout`, { layout });
  }

  async rename(id: string, name: string): Promise<void> {
    await send('PATCH', `${PATH}/agents/${id}`, { name });
  }

  async close(id: string): Promise<void> {
    await send('DELETE', `${PATH}/agents/${id}`);
  }

  async setVoice(agentId: string | null): Promise<void> {
    this.update({ voiceAgentId: agentId });
    await send('PUT', `${PATH}/voice`, { agentId });
  }

  protected receive(view: Omit<WorkspaceView, 'loaded'>): void {
    this.update({ ...view, loaded: true });
  }
}
