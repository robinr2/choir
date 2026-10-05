import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  MotionConfig,
  usePresence,
} from 'motion/react';
import * as m from 'motion/react-m';
import { memo, useEffect, useReducer, useRef, useState } from 'react';
import { AgentChat } from '@/agents/agent-chat';
import { LaunchForm } from '@/agents/launch-form';
import { ExcalidrawCanvas } from '@/canvas/excalidraw-canvas';
import { CoreConversation } from '@/conversation/core-conversation';
import { useEvents } from '@/lib/events-context';
import type { Frame, LayoutMotion } from '@/strip/layout-motion';
import type { Placement, Space } from '@/strip/placements';
import {
  useBackdropStyle,
  useTileStyle,
  useWorkspaceStyle,
} from '@/strip/tile-style';
import type {
  AgentView,
  PaneView,
  WorkspaceView,
} from '@/workspace/core-workspace';
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
  return (
    !!focused && !focused.matches('[data-slot="strip"], [data-slot="strip"] *')
  );
}

function focusInto(section: HTMLElement | null): void {
  if (!section || focusedElsewhere()) return;
  if (section.matches(':focus-within')) return;
  const target = section.querySelector('textarea') ?? section;
  target.focus();
}

function useFocusInto(focused: boolean) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) focusInto(section.current);
  }, [focused]);
  return section;
}

type PlacedProps = PaneProps &
  Readonly<{
    placement: Placement;
    layoutMotion: LayoutMotion;
    overview: boolean;
  }>;

function useClosing(layoutMotion: LayoutMotion, paneId: string): boolean {
  const [present, safeToRemove] = usePresence();
  useEffect(() => {
    if (present) return;
    void layoutMotion.close(paneId).then(safeToRemove);
  }, [present, layoutMotion, paneId, safeToRemove]);
  return !present;
}

function usePlaced({ pane, placement, layoutMotion, overview }: PlacedProps) {
  const style = useTileStyle(layoutMotion, placement);
  const closing = useClosing(layoutMotion, pane.id);
  const section = useFocusInto(placement.focused && !closing && !overview);
  return {
    style,
    section,
    hidden: closing || undefined,
    paneId: closing ? undefined : pane.id,
  };
}

function AgentBody({
  agent,
  isVoice,
}: Readonly<{ agent: AgentView; isVoice: boolean }>) {
  const events = useEvents();
  const [conversation] = useState(
    () => new CoreConversation(agent.id, events.conversation(agent.id)),
  );
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

function voiceOf({ pane, isVoice }: PaneProps): boolean | undefined {
  return pane.kind === 'agent' ? isVoice : undefined;
}

function Pane(props: PlacedProps) {
  const { pane, isVoice, placement, overview } = props;
  const { style, section, hidden, paneId } = usePlaced(props);
  const { focused, active, dragged } = placement;
  return (
    <m.section
      ref={section}
      aria-label={paneTitle(pane)}
      aria-hidden={hidden}
      data-slot="pane"
      data-pane-id={paneId}
      data-kind={pane.kind}
      data-focused={focused}
      data-voice={voiceOf(props)}
      tabIndex={-1}
      className="absolute top-0 left-0 outline-none aria-hidden:pointer-events-none data-[dragged=true]:z-1 data-[dragged=true]:opacity-75"
      data-dragged={dragged}
      style={style.frame}
    >
      <m.div
        className={paneClass(focused, active)}
        style={style.content}
        inert={overview}
      >
        <PaneBody pane={pane} isVoice={isVoice} />
      </m.div>
    </m.section>
  );
}

type PanesProps = Readonly<{
  frame: Frame;
  view: WorkspaceView;
  layoutMotion: LayoutMotion;
  overview: boolean;
}>;

function Workspace({
  space,
  layoutMotion,
  overview,
}: Readonly<{ space: Space; layoutMotion: LayoutMotion; overview: boolean }>) {
  const style = useWorkspaceStyle(layoutMotion, space);
  const { id } = space;
  return (
    <m.div
      aria-hidden
      data-slot="workspace"
      data-workspace-id={overview ? id : undefined}
      className="bg-background absolute top-0 left-0 rounded-3xl shadow-2xl data-[workspace-id]:pointer-events-auto pointer-events-none"
      style={style}
    />
  );
}

function Backdrop({ layoutMotion }: Readonly<{ layoutMotion: LayoutMotion }>) {
  const style = useBackdropStyle(layoutMotion);
  return (
    <m.div
      aria-hidden
      className="bg-muted pointer-events-none absolute inset-0"
      style={style}
    />
  );
}

function placedPanes({ frame, view, layoutMotion, overview }: PanesProps) {
  return frame.placements.map((placement) => {
    const pane = view.panes.find(({ id }) => id === placement.paneId);
    return (
      pane && (
        <Pane
          key={placement.paneId}
          pane={pane}
          isVoice={view.voiceAgentId === pane.id}
          placement={placement}
          layoutMotion={layoutMotion}
          overview={overview}
        />
      )
    );
  });
}

export function Panes(props: PanesProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="never">
        <Backdrop layoutMotion={props.layoutMotion} />
        {props.frame.spaces.map((space) => (
          <Workspace
            key={space.id}
            space={space}
            layoutMotion={props.layoutMotion}
            overview={props.overview}
          />
        ))}
        <AnimatePresence initial={false}>{placedPanes(props)}</AnimatePresence>
      </MotionConfig>
    </LazyMotion>
  );
}
