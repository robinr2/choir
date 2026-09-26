import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { AgentView } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';
import { AgentChat } from './agent-chat';
import { usePaneDrop } from './pane-swap';
import { PaneTitleBar } from './pane-title-bar';

function paneClass(isVoice: boolean, isTarget: boolean): string {
  return cn(
    'bg-background flex h-full flex-col overflow-hidden rounded-lg border transition-[border-color,box-shadow]',
    isVoice &&
      'border-active/50 shadow-[0_0_0_1px_color-mix(in_oklab,var(--active-background)_25%,transparent)]',
    isTarget && 'border-ring ring-ring/40 ring-2',
  );
}

function PaneFrame({
  agent,
  isVoice,
}: Readonly<{ agent: AgentView; isVoice: boolean }>) {
  const { workspace } = useWorkspace();
  const swap = useCallback(
    (source: string) => void workspace.swap(source, agent.id),
    [workspace, agent.id],
  );
  const drop = usePaneDrop(agent.id, swap);
  return (
    <div className="h-full" {...drop.handlers}>
      <section
        aria-label={agent.name}
        data-voice={isVoice}
        data-drop-target={drop.isTarget}
        className={paneClass(isVoice, drop.isTarget)}
      >
        <PaneTitleBar agent={agent} isVoice={isVoice} />
        <div className="min-h-0 flex-1">
          <AgentChat agentId={agent.id} isVoice={isVoice} />
        </div>
      </section>
    </div>
  );
}

export function AgentPane({ id }: Readonly<{ id: string }>) {
  const { view } = useWorkspace();
  const agent = view.agents.find((candidate) => candidate.id === id);
  if (!agent) return null;
  return <PaneFrame agent={agent} isVoice={view.voiceAgentId === id} />;
}
