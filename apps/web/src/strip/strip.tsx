import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { Panes } from '@/panes/pane';
import { InsertHint } from './insert-hint';
import { KeyHint } from './key-hint';
import { type Frame, LayoutMotion, type Tracking } from './layout-motion';
import { run } from './commands';
import { commandFor } from './keys';
import { workspaceAt, workspaceStep, zoomOf } from './overview';
import { OverviewWheel } from './overview-wheel';
import { focusedPaneId, placements, spaces } from './placements';
import { useStrip } from './strip-context';
import { press } from './strip-press';
import type { Snapshot, Store } from './types';
import { WheelBinds } from './wheel';

function keys(store: Store) {
  return (event: KeyboardEvent) => {
    const command = commandFor(event, store.getSnapshot().overview);
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    void run(store, command);
  };
}

function workspaceUnder(store: Store, root: HTMLElement, event: WheelEvent) {
  const snapshot = store.getSnapshot();
  const y = event.clientY - root.getBoundingClientRect().top;
  const index = workspaceAt(snapshot, y);
  return index === null ? undefined : snapshot.view.workspaces[index].id;
}

function overviewWheel(store: Store, root: HTMLElement) {
  const binds = new OverviewWheel();
  return (event: WheelEvent) => {
    if (!store.getSnapshot().overview || event.altKey) return false;
    event.preventDefault();
    const under = workspaceUnder(store, root, event);
    for (const action of binds.commands(event, under)) {
      void store.workspace.act(action);
    }
    return true;
  };
}

function wheel(store: Store, root: HTMLElement) {
  const binds = new WheelBinds();
  const overview = overviewWheel(store, root);
  return (event: WheelEvent) => {
    if (overview(event) || !event.altKey) return;
    event.preventDefault();
    for (const action of binds.commands(event)) {
      void store.workspace.act({ action });
    }
  };
}

function suppressMenu(store: Store, root: HTMLElement) {
  return (event: MouseEvent) => {
    const inside = event.target instanceof Node && root.contains(event.target);
    const overview = inside && store.getSnapshot().overview;
    if (event.altKey || overview) event.preventDefault();
  };
}

function frameFocus(store: Store) {
  return () => {
    const panes = document.querySelectorAll<HTMLElement>('[data-pane-id]');
    const pane = [...panes].find((candidate) =>
      candidate.contains(document.activeElement),
    );
    const paneId = pane?.dataset.paneId;
    if (!paneId || focusedPaneId(store.getSnapshot()) === paneId) return;
    void store.workspace.act({ action: 'focusPane', paneId });
  };
}

function listen(store: Store, root: HTMLDivElement, signal: AbortSignal) {
  const capture = { capture: true, signal };
  window.addEventListener('keydown', keys(store), capture);
  window.addEventListener('wheel', wheel(store, root), {
    ...capture,
    passive: false,
  });
  window.addEventListener('contextmenu', suppressMenu(store, root), capture);
  window.addEventListener('blur', frameFocus(store), { signal });
  root.addEventListener(
    'pointerdown',
    (event) => press({ store, root, event }),
    capture,
  );
}

function holdFocus(store: Store, root: HTMLElement) {
  return store.subscribe(() => {
    if (store.getSnapshot().overview) root.focus();
  });
}

function useStripRoot(store: Store) {
  return useCallback(
    (root: HTMLDivElement) => {
      const release = holdFocus(store, root);
      const controller = new AbortController();
      const observer = new ResizeObserver(([entry]) => {
        store.measure(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(root);
      listen(store, root, controller.signal);
      return () => {
        observer.disconnect();
        controller.abort();
        release();
      };
    },
    [store],
  );
}

function grabbed(cursor: string | null) {
  return { cursor: cursor ?? undefined };
}

function trackingOf({ gesture, overlay }: Snapshot): Tracking {
  if (gesture === null) return 'none';
  return overlay?.dragged ? 'view' : 'all';
}

function frameOf(snapshot: Snapshot): Frame {
  const { metrics, view, renderIndex } = snapshot;
  return {
    placements: placements(snapshot),
    spaces: spaces(snapshot),
    renderIndex,
    step: workspaceStep(metrics),
    width: metrics.width,
    height: metrics.height,
    zoom: zoomOf(snapshot.overview),
    ready: view.loaded && metrics.height > 0,
    tracking: trackingOf(snapshot),
  };
}

function useLayoutMotion(frame: Frame): LayoutMotion {
  const [layoutMotion] = useState(() => new LayoutMotion());
  useLayoutEffect(() => layoutMotion.apply(frame), [layoutMotion, frame]);
  return layoutMotion;
}

export function Strip() {
  const store = useStrip();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const root = useStripRoot(store);
  const frame = useMemo(() => frameOf(snapshot), [snapshot]);
  const layoutMotion = useLayoutMotion(frame);
  const hint = snapshot.overlay?.hint;
  return (
    <div
      ref={root}
      data-slot="strip"
      data-gesture={snapshot.gesture !== null}
      data-overview={snapshot.overview}
      tabIndex={-1}
      style={grabbed(snapshot.gesture)}
      className="relative size-full overflow-clip outline-none data-[gesture=true]:select-none data-[gesture=true]:**:cursor-[inherit] data-[gesture=true]:[&_iframe]:pointer-events-none"
    >
      <Panes
        frame={frame}
        view={snapshot.view}
        layoutMotion={layoutMotion}
        overview={snapshot.overview}
      />
      {hint && <InsertHint rect={hint} />}
      <KeyHint overview={snapshot.overview} height={snapshot.metrics.height} />
    </div>
  );
}
