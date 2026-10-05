import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  MotionConfig,
} from 'motion/react';
import { memo, useReducer, useState } from 'react';
import { AgentChat } from '@/agents/agent-chat';
import { LaunchForm } from '@/agents/launch-form';
import { ExcalidrawCanvas } from '@/canvas/excalidraw-canvas';
import { CoreConversation } from '@/conversation/core-conversation';
import { useEvents } from '@/lib/events-context';
import type { Frame, LayoutMotion } from '@/strip/layout-motion';
import type {
  AgentView,
  PaneView,
  WorkspaceView,
} from '@/workspace/core-workspace';
import { EmptyPane } from './empty-pane';
import { AgentHeading } from './agent-heading';
import { PaneTitleBar } from './pane-title-bar';
import {
  Backdrop,
  type PaneProps,
  PlacedPane,
  type PlacedProps,
  Workspace,
} from './placed';

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

function Pane(props: PlacedProps) {
  const { pane, isVoice } = props;
  return (
    <PlacedPane {...props}>
      <PaneBody pane={pane} isVoice={isVoice} />
    </PlacedPane>
  );
}

type PanesProps = Readonly<{
  frame: Frame;
  view: WorkspaceView;
  layoutMotion: LayoutMotion;
  overview: boolean;
}>;

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
        <AnimatePresence>{placedPanes(props)}</AnimatePresence>
      </MotionConfig>
    </LazyMotion>
  );
}
