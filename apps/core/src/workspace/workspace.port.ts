import type { Observable } from 'rxjs';
import type { Edge, LayoutNode } from '../layout/layout-tree.js';
import type { Agent, SplitKind } from '../layout/layout.schemas.js';

export type { Agent, Edge, LayoutNode, SplitKind };

export const WORKSPACE = Symbol('Workspace');

export type WorkspaceView = {
  layout: LayoutNode | null;
  agents: (Agent & { working: boolean })[];
  voiceAgentId: string | null;
};

export type AgentListing = {
  agents: (Agent & { status: 'working' | 'idle'; you: boolean })[];
  layout: LayoutNode | null;
};

export type Workspace = {
  readonly changes: Observable<WorkspaceView>;
  view(): Promise<WorkspaceView>;
  split(id: string, kind: SplitKind, name?: string): Promise<Agent>;
  addAtEdge(edge: Edge, name?: string): Promise<Agent>;
  swap(first: string, second: string): Promise<void>;
  resize(layout: LayoutNode | null): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  close(id: string): Promise<void>;
  activateVoice(agentId: string | null): void;
  sendMessage(fromId: string, toId: string, text: string): void;
  list(callerId: string): Promise<AgentListing>;
};
