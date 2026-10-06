import { usePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { type ReactNode, useEffect, useRef } from 'react';
import type { LayoutMotion } from '@/strip/layout-motion';
import type { Placement, Space } from '@/strip/placements';
import {
  useBackdropStyle,
  useTileStyle,
  useWorkspaceStyle,
} from '@/strip/tile-style';
import type { PaneView } from '@/workspace/core-workspace';
import { paneClass, paneTitle } from './pane-frame';

export type PaneProps = Readonly<{ pane: PaneView; isVoice: boolean }>;

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

export type PlacedProps = PaneProps &
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

export function Workspace({
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

export function Backdrop({
  layoutMotion,
}: Readonly<{ layoutMotion: LayoutMotion }>) {
  const style = useBackdropStyle(layoutMotion);
  return (
    <m.div
      aria-hidden
      data-slot="backdrop"
      className="bg-muted pointer-events-none absolute inset-0"
      style={style}
    />
  );
}

function voiceOf({ pane, isVoice }: PaneProps): boolean | undefined {
  return pane.kind === 'agent' ? isVoice : undefined;
}

export function PlacedPane(
  props: PlacedProps & Readonly<{ children: ReactNode }>,
) {
  const { pane, placement, overview, children } = props;
  const { style, section, hidden, paneId } = usePlaced(props);
  return (
    <m.section
      ref={section}
      aria-label={paneTitle(pane)}
      aria-hidden={hidden}
      data-slot="pane"
      data-pane-id={paneId}
      data-kind={pane.kind}
      data-focused={placement.focused}
      data-voice={voiceOf(props)}
      tabIndex={-1}
      className="absolute top-0 left-0 outline-none aria-hidden:pointer-events-none data-[dragged=true]:z-1 data-[dragged=true]:opacity-75"
      data-dragged={placement.dragged}
      style={style.frame}
    >
      <m.div
        className={paneClass(placement.focused, placement.muted)}
        style={style.content}
        inert={overview}
      >
        {children}
      </m.div>
    </m.section>
  );
}
