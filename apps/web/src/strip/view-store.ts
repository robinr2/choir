import type {
  CoreWorkspace,
  StripLayout,
  WorkspaceView,
} from '@/workspace/core-workspace';
import { anchored } from './anchor';
import { GAP } from './geometry';
import { DoubleClicks } from './resize-edges';
import type {
  Anchor,
  Metrics,
  Overlay,
  Snapshot,
  Store,
  StripView,
} from './types';
import { fitted, nextStripView, refitted } from './view-diff';

type Strips = Map<string, StripView>;

function synced(
  strips: ReadonlyMap<string, StripView>,
  view: WorkspaceView,
  metrics: Metrics,
): Strips {
  return new Map(
    view.workspaces.map((layout) => [
      layout.id,
      nextStripView(strips.get(layout.id), layout, metrics),
    ]),
  );
}

export class ViewStore implements Store {
  readonly workspace: CoreWorkspace;
  readonly clicks = new DoubleClicks();
  #seen: WorkspaceView | null = null;
  #snapshot: Snapshot;
  #anchor: Anchor | null = null;
  readonly #listeners = new Set<() => void>();

  constructor(workspace: CoreWorkspace) {
    this.workspace = workspace;
    const view = workspace.getSnapshot();
    this.#snapshot = {
      view,
      metrics: { width: 0, height: 0, gap: GAP },
      strips: new Map(),
      overlay: null,
      renderIndex: view.activeWorkspace,
      gesture: null,
    };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    const stop = this.workspace.subscribe(() => {
      this.getSnapshot();
      listener();
    });
    return () => {
      stop();
      this.#listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): Snapshot => {
    const view = this.workspace.getSnapshot();
    if (view !== this.#seen) this.#sync(view);
    return this.#snapshot;
  };

  measure(width: number, height: number): void {
    const metrics = { width, height, gap: GAP };
    const strips = new Map(
      [...this.getSnapshot().strips].map(([id, strip]) => [
        id,
        refitted(strip, metrics),
      ]),
    );
    this.#set({ metrics, strips });
  }

  show(overlay: Overlay | null): void {
    this.#set({ overlay });
  }

  grab(gesture: string | null): void {
    this.#set({ gesture });
  }

  scrollWorkspaces(renderIndex: number): void {
    this.#set({ renderIndex });
  }

  commit(layout: StripLayout, viewX: number): void {
    const { strips, metrics } = this.getSnapshot();
    const saved = strips.get(layout.id)?.saved ?? 0;
    const next = new Map(strips);
    next.set(layout.id, fitted(layout, viewX, saved, metrics));
    this.#set({ strips: next, overlay: null });
  }

  anchor(anchor: Anchor): void {
    this.#anchor = anchor;
  }

  #sync(view: WorkspaceView): void {
    this.#seen = view;
    const { metrics } = this.#snapshot;
    const strips = synced(this.#snapshot.strips, view, metrics);
    const moved = this.#anchor && anchored(this.#anchor, strips, metrics);
    if (moved) this.#anchor = null;
    this.#snapshot = {
      ...this.#snapshot,
      view,
      strips: moved || strips,
      renderIndex: view.activeWorkspace,
    };
  }

  #set(change: Partial<Snapshot>): void {
    this.#snapshot = { ...this.getSnapshot(), ...change };
    this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}
