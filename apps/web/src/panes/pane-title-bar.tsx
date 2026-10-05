import type { ReactNode } from 'react';
import { GripVerticalIcon } from 'lucide-react';
import type { PaneView } from '@/workspace/core-workspace';
import { PaneControls } from './pane-controls';
import { paneTitle } from './pane-frame';

export function PaneTitleBar({
  pane,
  children,
}: Readonly<{ pane: PaneView; children?: ReactNode }>) {
  return (
    <div
      data-slot="pane-title"
      className="border-border/60 flex h-9 shrink-0 cursor-grab items-center gap-1.5 border-b px-1.5 active:cursor-grabbing"
    >
      <GripVerticalIcon
        className="text-muted-foreground/60 size-3.5 shrink-0"
        aria-hidden
      />
      {children ?? (
        <span className="flex-1 truncate px-1.5 py-0.5 text-sm font-medium">
          {paneTitle(pane)}
        </span>
      )}
      <PaneControls id={pane.id} />
    </div>
  );
}
