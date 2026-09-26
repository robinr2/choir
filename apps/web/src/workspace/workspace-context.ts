import { createContext, use, useSyncExternalStore } from 'react';
import type { CoreWorkspace, WorkspaceView } from './core-workspace';

type Voice = { toggle(agentId: string): Promise<void> };

export type Workspace = { workspace: CoreWorkspace; voice: Voice };

export const WorkspaceContext = createContext<Workspace | null>(null);

export const AgentContext = createContext<string | undefined>(undefined);

export function useWorkspace(): Workspace & { view: WorkspaceView } {
  const context = use(WorkspaceContext);
  if (!context) throw new Error('useWorkspace needs a WorkspaceContext');
  const view = useSyncExternalStore(
    context.workspace.subscribe,
    context.workspace.getSnapshot,
  );
  return { ...context, view };
}

export function useAgentId(): string {
  const agentId = use(AgentContext);
  if (agentId === undefined)
    throw new Error('useAgentId needs an AgentContext');
  return agentId;
}
