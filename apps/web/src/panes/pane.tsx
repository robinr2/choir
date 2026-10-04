import { type CSSProperties, memo } from 'react';
import { AgentChat } from '@/agents/agent-chat';
import { ExcalidrawCanvas } from '@/canvas/excalidraw-canvas';
import type { Placement } from '@/strip/placements';
import type { PaneView } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';
import { EmptyPane } from './empty-pane';
import { paneClass, paneTitle } from './pane-frame';
import { PaneTitleBar } from './pane-title-bar';

type PaneProps = Readonly<{ pane: PaneView; isVoice: boolean }>;

const PaneContent = memo(function PaneContent({ pane, isVoice }: PaneProps) {
  if (pane.kind === 'agent') {
    return <AgentChat agentId={pane.id} isVoice={isVoice} />;
  }
  if (pane.kind === 'excalidraw') return <ExcalidrawCanvas />;
  return <EmptyPane id={pane.id} />;
});

function focusedElsewhere(): boolean {
  const focused = document.querySelector(':focus');
  return !!focused && !focused.matches('[data-slot="strip"] *');
}

function focusInto(section: HTMLElement | null): void {
  if (!section || focusedElsewhere()) return;
  if (section.matches(':focus-within')) return;
  const target = section.querySelector('textarea') ?? section;
  target.focus();
}

function placed({ rect, dragged }: Placement): CSSProperties {
  return {
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: rect.width,
    height: rect.height,
    opacity: dragged ? 0.75 : undefined,
    zIndex: dragged ? 1 : undefined,
  };
}

function PaneFrame({
  pane,
  isVoice,
  placement,
}: PaneProps & Readonly<{ placement: Placement }>) {
  return (
    <section
      ref={placement.focused ? focusInto : undefined}
      aria-label={paneTitle(pane)}
      data-slot="pane"
      data-pane-id={pane.id}
      data-kind={pane.kind}
      data-focused={placement.focused}
      data-voice={pane.kind === 'agent' ? isVoice : undefined}
      tabIndex={-1}
      className="absolute top-0 left-0"
      style={placed(placement)}
    >
      <div className={paneClass(placement.focused)}>
        <PaneTitleBar pane={pane} isVoice={isVoice} />
        <div className="min-h-0 flex-1">
          <PaneContent pane={pane} isVoice={isVoice} />
        </div>
      </div>
    </section>
  );
}

export function Pane({ placement }: Readonly<{ placement: Placement }>) {
  const { view } = useWorkspace();
  const pane = view.panes.find(({ id }) => id === placement.paneId);
  if (!pane) return null;
  return (
    <PaneFrame
      pane={pane}
      isVoice={view.voiceAgentId === pane.id}
      placement={placement}
    />
  );
}
