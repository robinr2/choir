import type {
  CoreWorkspace,
  LayoutAction,
  StripLayout,
  WorkspaceView,
} from '@/workspace/core-workspace';

export type Metrics = { width: number; height: number; gap: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type StripView = {
  layout: StripLayout;
  offset: number;
  saved: number;
};

export type Strip = { layout: StripLayout; viewX: number };

export type Location = { column: number; tile: number };

export type Overlay = {
  layout?: StripLayout;
  viewX?: number;
  dragged?: { paneId: string } & Rect;
  hint?: Rect;
};

export type Snapshot = {
  view: WorkspaceView;
  metrics: Metrics;
  strips: ReadonlyMap<string, StripView>;
  overlay: Overlay | null;
  renderIndex: number;
  gesture: string | null;
};

export type Edges = {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
};

export type Press = { paneId: string; time: number; edges: Edges };

export type Anchor = { workspaceId: string; columnId: string; width: number };

export type Command = LayoutAction | 'close' | 'open' | 'expand';

export type Store = {
  readonly workspace: CoreWorkspace;
  readonly clicks: { repeated(press: Press): Edges | null };
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => Snapshot;
  measure(width: number, height: number): void;
  show(overlay: Overlay | null): void;
  grab(gesture: string | null): void;
  scrollWorkspaces(renderIndex: number): void;
  commit(layout: StripLayout, viewX: number): void;
  anchor(anchor: Anchor): void;
};
