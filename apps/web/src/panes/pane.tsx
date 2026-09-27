import { AgentChat } from '@/agents/agent-chat';
import { ExcalidrawCanvas } from '@/canvas/excalidraw-canvas';
import type { PaneView } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';
import { EmptyPane } from './empty-pane';
import { paneClass, paneTitle } from './pane-frame';
import { usePaneDrop } from './pane-swap';
import { PaneTitleBar } from './pane-title-bar';

type PaneProps = Readonly<{ pane: PaneView; isVoice: boolean }>;

function PaneContent({ pane, isVoice }: PaneProps) {
  if (pane.kind === 'agent') {
    return <AgentChat agentId={pane.id} isVoice={isVoice} />;
  }
  if (pane.kind === 'excalidraw') return <ExcalidrawCanvas />;
  return <EmptyPane id={pane.id} />;
}

function PaneFrame({ pane, isVoice }: PaneProps) {
  const drop = usePaneDrop(pane.id);
  return (
    <div className="h-full" {...drop.handlers}>
      <section
        aria-label={paneTitle(pane)}
        data-kind={pane.kind}
        data-voice={pane.kind === 'agent' ? isVoice : undefined}
        data-drop-target={drop.isTarget}
        className={paneClass(drop.isTarget)}
      >
        <PaneTitleBar pane={pane} isVoice={isVoice} />
        <div className="min-h-0 flex-1">
          <PaneContent pane={pane} isVoice={isVoice} />
        </div>
      </section>
    </div>
  );
}

export function Pane({ id }: Readonly<{ id: string }>) {
  const { view } = useWorkspace();
  const pane = view.panes.find((candidate) => candidate.id === id);
  if (!pane) return null;
  return <PaneFrame pane={pane} isVoice={view.voiceAgentId === id} />;
}
