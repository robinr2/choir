import { cn } from '@/lib/utils';
import type { PaneView } from '@/workspace/core-workspace';

const TITLES = { empty: 'New pane', excalidraw: 'Excalidraw' } as const;

export function paneTitle(pane: PaneView): string {
  return pane.kind === 'agent' ? pane.name : TITLES[pane.kind];
}

export function paneClass(isVoice: boolean, isTarget: boolean): string {
  return cn(
    'bg-background flex h-full flex-col overflow-hidden rounded-lg border transition-[border-color,box-shadow]',
    isVoice &&
      'border-active/50 shadow-[0_0_0_1px_color-mix(in_oklab,var(--active-background)_25%,transparent)]',
    isTarget && 'border-ring ring-ring/40 ring-2',
  );
}
