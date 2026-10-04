import type { Observable } from 'rxjs';
import type {
  Agent,
  LayoutAction,
  NewPane,
  OpenableKind,
  Pane,
  PaneContent,
  Layout,
} from '../layout/layout.schemas.js';

export type { LayoutAction, NewPane, OpenableKind, Pane, PaneContent };

export const WORKSPACE = Symbol('Workspace');

export type PaneView =
  | { id: string; kind: 'empty' }
  | { id: string; kind: 'agent'; name: string; working: boolean }
  | { id: string; kind: 'excalidraw' };

export type WorkspaceView = Layout & {
  panes: PaneView[];
  voiceAgentId: string | null;
};

export type AgentListing = {
  agents: (Agent & { status: 'working' | 'idle'; you: boolean })[];
  otherPanes: { id: string; kind: 'empty' | 'excalidraw' }[];
  layout: Layout;
};

export type Workspace = {
  readonly changes: Observable<WorkspaceView>;
  view(): Promise<WorkspaceView>;
  openPane(pane: NewPane): Promise<Pane>;
  open(id: string, kind: OpenableKind): Promise<Pane>;
  act(action: LayoutAction): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  close(id: string): Promise<void>;
  activateVoice(agentId: string | null): void;
  sendMessage(fromId: string, toId: string, text: string): void;
  list(callerId: string): Promise<AgentListing>;
};
