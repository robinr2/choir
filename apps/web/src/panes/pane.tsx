import { type CSSProperties, memo, useReducer, useState } from 'react';
import { AgentChat } from '@/agents/agent-chat';
import { LaunchForm } from '@/agents/launch-form';
import { ExcalidrawCanvas } from '@/canvas/excalidraw-canvas';
import { CoreConversation } from '@/conversation/core-conversation';
import type { Placement } from '@/strip/placements';
import type { AgentView, PaneView } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';
import { EmptyPane } from './empty-pane';
import { paneClass, paneTitle } from './pane-frame';
import { AgentHeading } from './agent-heading';
import { PaneTitleBar } from './pane-title-bar';

type PaneProps = Readonly<{ pane: PaneView; isVoice: boolean }>;

function flip(open: boolean): boolean {
  return !open;
}

function NewPane({ id }: Readonly<{ id: string }>) {
  const [launching, toggleLaunching] = useReducer(flip, false);
  if (launching) return <LaunchForm paneId={id} onCancel={toggleLaunching} />;
  return <EmptyPane id={id} onAgent={toggleLaunching} />;
}

const ChatContent = memo(AgentChat);

const PaneContent = memo(function PaneContent({
  pane,
}: Readonly<{ pane: Exclude<PaneView, AgentView> }>) {
  if (pane.kind === 'excalidraw') return <ExcalidrawCanvas />;
  return <NewPane id={pane.id} />;
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

function AgentBody({
  agent,
  isVoice,
}: Readonly<{ agent: AgentView; isVoice: boolean }>) {
  const [conversation] = useState(() => new CoreConversation(agent.id));
  return (
    <>
      <PaneTitleBar pane={agent}>
        <AgentHeading
          pane={agent}
          conversation={conversation}
          isVoice={isVoice}
        />
      </PaneTitleBar>
      <div className="min-h-0 flex-1">
        <ChatContent conversation={conversation} isVoice={isVoice} />
      </div>
    </>
  );
}

function PaneBody({ pane, isVoice }: PaneProps) {
  if (pane.kind === 'agent')
    return <AgentBody agent={pane} isVoice={isVoice} />;
  return (
    <>
      <PaneTitleBar pane={pane} />
      <div className="min-h-0 flex-1">
        <PaneContent pane={pane} />
      </div>
    </>
  );
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
        <PaneBody pane={pane} isVoice={isVoice} />
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
