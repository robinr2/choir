import { cn } from '@/lib/utils';
import type { PaneView } from '@/workspace/core-workspace';

const TITLES = { empty: 'New pane', excalidraw: 'Excalidraw' } as const;

export function paneTitle(pane: PaneView): string {
  return pane.kind === 'agent' ? pane.name : TITLES[pane.kind];
}

export function paneClass(isTarget: boolean): string {
  return cn(
    'bg-background flex h-full flex-col overflow-hidden rounded-lg border transition-[border-color,box-shadow]',
    isTarget && 'border-ring ring-ring/40 ring-2',
  );
}
