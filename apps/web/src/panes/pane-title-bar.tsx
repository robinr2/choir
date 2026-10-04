import { GripVerticalIcon } from 'lucide-react';
import type { PaneView } from '@/workspace/core-workspace';
import { PaneControls } from './pane-controls';
import { PaneName } from './pane-name';
import { paneTitle } from './pane-frame';

function AgentStatus({
  working,
  isVoice,
}: Readonly<{ working: boolean; isVoice: boolean }>) {
  return (
    <>
      {isVoice && (
        <output
          aria-label="Voice is on"
          className="bg-active size-1.5 shrink-0 rounded-full"
        />
      )}
      {working && (
        <span className="text-muted-foreground text-xs">working</span>
      )}
    </>
  );
}

function PaneHeading({
  pane,
  isVoice,
}: Readonly<{ pane: PaneView; isVoice: boolean }>) {
  if (pane.kind !== 'agent') {
    return (
      <span className="truncate px-1.5 py-0.5 text-sm font-medium">
        {paneTitle(pane)}
      </span>
    );
  }
  return (
    <>
      <PaneName id={pane.id} name={pane.name} />
      <AgentStatus working={pane.working} isVoice={isVoice} />
    </>
  );
}

export function PaneTitleBar({
  pane,
  isVoice,
}: Readonly<{ pane: PaneView; isVoice: boolean }>) {
  return (
    <div
      data-slot="pane-title"
      className="border-border/60 flex h-9 shrink-0 cursor-grab items-center gap-1 border-b px-1.5 active:cursor-grabbing"
    >
      <GripVerticalIcon
        className="text-muted-foreground/60 size-3.5 shrink-0"
        aria-hidden
      />
      <PaneHeading pane={pane} isVoice={isVoice} />
      <PaneControls id={pane.id} />
    </div>
  );
}
