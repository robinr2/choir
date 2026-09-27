import type { Observable } from 'rxjs';
import type { Edge, LayoutNode } from '../layout/layout-tree.js';
import type {
  Agent,
  NewPane,
  OpenableKind,
  Pane,
  PaneContent,
  SplitKind,
} from '../layout/layout.schemas.js';

export type {
  Edge,
  LayoutNode,
  NewPane,
  OpenableKind,
  Pane,
  PaneContent,
  SplitKind,
};

export const WORKSPACE = Symbol('Workspace');

export type PaneView =
  | { id: string; kind: 'empty' }
  | { id: string; kind: 'agent'; name: string; working: boolean }
  | { id: string; kind: 'excalidraw' };

export type WorkspaceView = {
  layout: LayoutNode | null;
  panes: PaneView[];
  voiceAgentId: string | null;
};

export type AgentListing = {
  agents: (Agent & { status: 'working' | 'idle'; you: boolean })[];
  otherPanes: { id: string; kind: 'empty' | 'excalidraw' }[];
  layout: LayoutNode | null;
};

export type Workspace = {
  readonly changes: Observable<WorkspaceView>;
  view(): Promise<WorkspaceView>;
  split(id: string, kind: SplitKind, pane: NewPane): Promise<Pane>;
  addAtEdge(edge: Edge, pane: NewPane): Promise<Pane>;
  open(id: string, kind: OpenableKind): Promise<Pane>;
  swap(first: string, second: string): Promise<void>;
  resize(layout: LayoutNode | null): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  close(id: string): Promise<void>;
  activateVoice(agentId: string | null): void;
  sendMessage(fromId: string, toId: string, text: string): void;
  list(callerId: string): Promise<AgentListing>;
};
