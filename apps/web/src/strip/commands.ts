import type { Column } from '@/workspace/core-workspace';
import { columnWidth, columnXs, proportionOf } from './geometry';
import { activeStrip, focusedPaneId } from './placements';
import type { Command, Metrics, Store, Strip } from './types';

type Placed = { column: Column; x: number; width: number };

function placed({ layout }: Strip, metrics: Metrics): Placed[] {
  const xs = columnXs(layout.columns, metrics);
  return layout.columns.map((column, index) => ({
    column,
    x: xs[index],
    width: columnWidth(column, metrics),
  }));
}

function onScreen({ viewX }: Strip, { width: view, gap }: Metrics) {
  return {
    leftOf: ({ x }: Placed) => x < viewX + gap,
    rightOf: ({ x, width }: Placed) => viewX + view < x + width + gap,
  };
}

export function fullyVisible(strip: Strip, metrics: Metrics): Placed[] {
  const { leftOf, rightOf } = onScreen(strip, metrics);
  const candidates = placed(strip, metrics).filter((entry) => !leftOf(entry));
  const cut = candidates.findIndex(rightOf);
  return cut < 0 ? candidates : candidates.slice(0, cut);
}

function widens(strip: Strip, visible: Placed[], metrics: Metrics): boolean {
  const active = strip.layout.columns[strip.layout.activeColumn];
  const taken = visible.reduce(
    (sum, { width }) => sum + width + metrics.gap,
    0,
  );
  const available = metrics.width - metrics.gap - taken;
  return (
    !active.fullWidth &&
    visible.length > 1 &&
    visible.some(({ column }) => column === active) &&
    available > 0
  );
}

export function expand(store: Store): Promise<void> {
  const snapshot = store.getSnapshot();
  const strip = activeStrip(snapshot);
  if (!strip || strip.layout.columns.length === 0) return Promise.resolve();
  const visible = fullyVisible(strip, snapshot.metrics);
  if (widens(strip, visible, snapshot.metrics)) {
    const active = strip.layout.columns[strip.layout.activeColumn];
    store.anchor({
      workspaceId: strip.layout.id,
      columnId: visible[0].column.id,
      width: proportionOf(active),
    });
  }
  return store.workspace.act({
    action: 'expandColumnToAvailableWidth',
    visibleColumns: visible.map(({ column }) => column.id),
  });
}

function closeFocused(store: Store): Promise<void> {
  const id = focusedPaneId(store.getSnapshot());
  return id ? store.workspace.close(id) : Promise.resolve();
}

export function run(store: Store, command: Command): Promise<void> {
  if (command === 'open') return store.workspace.openPane();
  if (command === 'close') return closeFocused(store);
  if (command === 'expand') return expand(store);
  return store.workspace.act(command);
}
