import { GripVerticalIcon } from 'lucide-react';
import type { AgentView } from '@/workspace/core-workspace';
import { PaneControls } from './pane-controls';
import { PaneName } from './pane-name';
import { startPaneDrag } from './pane-swap';

export function PaneTitleBar({
  agent,
  isVoice,
}: Readonly<{ agent: AgentView; isVoice: boolean }>) {
  return (
    <div
      data-slot="agent-pane-title"
      data-agent-id={agent.id}
      draggable
      onDragStart={startPaneDrag}
      className="border-border/60 flex h-9 shrink-0 cursor-grab items-center gap-1 border-b px-1.5 active:cursor-grabbing"
    >
      <GripVerticalIcon
        className="text-muted-foreground/60 size-3.5 shrink-0"
        aria-hidden
      />
      <PaneName id={agent.id} name={agent.name} />
      {isVoice && (
        <output
          aria-label="Voice is on"
          className="bg-active size-1.5 shrink-0 rounded-full"
        />
      )}
      {agent.working && (
        <span className="text-muted-foreground text-xs">working</span>
      )}
      <PaneControls id={agent.id} />
    </div>
  );
}
