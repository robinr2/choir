import { cn } from '@/lib/utils';
import type { PaneView } from '@/workspace/core-workspace';

const TITLES = { empty: 'New pane', excalidraw: 'Excalidraw' } as const;

export function paneTitle(pane: PaneView): string {
  return pane.kind === 'agent' ? pane.name : TITLES[pane.kind];
}

export function paneClass(focused: boolean): string {
  return cn(
    'bg-background flex size-full flex-col overflow-hidden rounded-lg border outline-none',
    focused && 'border-ring',
  );
}
