import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Pane } from '@/panes/pane';
import { run } from './commands';
import { InsertHint } from './insert-hint';
import { commandFor } from './keys';
import { startMove } from './move-gesture';
import { startPan } from './pan-gesture';
import { focusedPaneId, placements } from './placements';
import { startResize } from './resize-gesture';
import { type Grab, type Point, pointOf } from './session';
import { useStrip } from './strip-context';
import type { Store } from './types';
import { WheelBinds } from './wheel';

type Start = (grab: Grab, paneId: string, point: Point) => void;

const TITLE = '[data-slot="pane-title"], [data-slot="pane-title"] :not(input)';

function onTitle(target: Element): boolean {
  return target.matches(TITLE);
}

function moves(event: PointerEvent, target: Element): boolean {
  return event.button === 0 && (event.altKey || onTitle(target));
}

function gestureFor(event: PointerEvent, target: Element): Start | null {
  if (moves(event, target)) return startMove;
  if (!event.altKey) return null;
  return event.button === 2 ? startResize : null;
}

function focus(grab: Grab, paneId: string): void {
  const { store } = grab;
  if (focusedPaneId(store.getSnapshot()) === paneId) return;
  void store.workspace.act({ action: 'focusPane', paneId });
}

function pressPane(grab: Grab, target: Element): void {
  const paneId = target.closest('[data-pane-id]')?.getAttribute('data-pane-id');
  if (!paneId) return;
  focus(grab, paneId);
  const start = gestureFor(grab.event, target);
  if (!start) return;
  grab.event.preventDefault();
  start(grab, paneId, pointOf(grab.root, grab.event));
}

function press(grab: Grab): void {
  const { event, root } = grab;
  if (!(event.target instanceof Element)) return;
  if (!event.altKey || event.button !== 1) return pressPane(grab, event.target);
  event.preventDefault();
  startPan(grab, pointOf(root, event));
}

function keys(store: Store) {
  return (event: KeyboardEvent) => {
    const command = commandFor(event);
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    void run(store, command);
  };
}

function wheel(store: Store) {
  const binds = new WheelBinds();
  return (event: WheelEvent) => {
    if (!event.altKey) return;
    event.preventDefault();
    for (const action of binds.commands(event)) {
      void store.workspace.act({ action });
    }
  };
}

function suppressMenu(event: MouseEvent): void {
  if (event.altKey) event.preventDefault();
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
  window.addEventListener('wheel', wheel(store), {
    ...capture,
    passive: false,
  });
  window.addEventListener('contextmenu', suppressMenu, capture);
  window.addEventListener('blur', frameFocus(store), { signal });
  root.addEventListener(
    'pointerdown',
    (event) => press({ store, root, event }),
    capture,
  );
}

function useStripRoot(store: Store) {
  return useCallback(
    (root: HTMLDivElement) => {
      const controller = new AbortController();
      const observer = new ResizeObserver(([entry]) => {
        store.measure(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(root);
      listen(store, root, controller.signal);
      return () => {
        observer.disconnect();
        controller.abort();
      };
    },
    [store],
  );
}

function grabbed(cursor: string | null) {
  return { cursor: cursor ?? undefined };
}

export function Strip() {
  const store = useStrip();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const root = useStripRoot(store);
  const placed = useMemo(() => placements(snapshot), [snapshot]);
  const hint = snapshot.overlay?.hint;
  return (
    <div
      ref={root}
      data-slot="strip"
      data-gesture={snapshot.gesture !== null}
      style={grabbed(snapshot.gesture)}
      className="relative size-full overflow-clip data-[gesture=true]:select-none data-[gesture=true]:**:cursor-[inherit] data-[gesture=true]:[&_iframe]:pointer-events-none"
    >
      {placed.map((placement) => (
        <Pane key={placement.paneId} placement={placement} />
      ))}
      {hint && <InsertHint rect={hint} />}
    </div>
  );
}
