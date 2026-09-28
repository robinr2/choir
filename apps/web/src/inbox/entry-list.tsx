import {
  type DragEvent,
  type ReactNode,
  Suspense,
  useMemo,
  useState,
} from 'react';
import { leftFor } from '@/panes/pane-swap';
import type { ListKind } from './core-inbox';
import { useInbox } from './inbox-context';
import { type DraggedTodo, TODO_TYPE } from './todo-reference';

type Side = 'before' | 'after';

function entryType(kind: ListKind): string {
  return `application/x-choir-${kind}`;
}

function startDrag(
  event: DragEvent<HTMLElement>,
  kind: ListKind,
  { id, title }: DraggedTodo,
): void {
  event.stopPropagation();
  event.dataTransfer.setData(entryType(kind), id);
  if (kind === 'todos')
    event.dataTransfer.setData(TODO_TYPE, JSON.stringify({ id, title }));
  event.dataTransfer.effectAllowed = 'move';
}

function sideOf(event: DragEvent<HTMLElement>): Side {
  const box = event.currentTarget.getBoundingClientRect();
  return event.clientY < box.top + box.height / 2 ? 'before' : 'after';
}

function accepted(
  event: DragEvent<HTMLElement>,
  kind: ListKind,
  enabled: boolean,
): boolean {
  if (!enabled || !event.dataTransfer.types.includes(entryType(kind)))
    return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function dropped(event: DragEvent<HTMLElement>, kind: ListKind, id: string) {
  const moved = event.dataTransfer.getData(entryType(kind));
  const placement = sideOf(event) === 'before' ? { before: id } : { after: id };
  return moved === id ? null : { moved, placement };
}

function useEntryDrag(kind: ListKind, entry: DraggedTodo, enabled: boolean) {
  const { inbox } = useInbox();
  const [side, setSide] = useState<Side | null>(null);
  const handlers = useMemo(
    () => ({
      onDragStart: (event: DragEvent<HTMLElement>) =>
        startDrag(event, kind, entry),
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (accepted(event, kind, enabled)) setSide(sideOf(event));
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (leftFor(event)) setSide(null);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!accepted(event, kind, enabled)) return;
        setSide(null);
        const drop = dropped(event, kind, entry.id);
        if (drop) void inbox.move(kind, drop.moved, drop.placement);
      },
    }),
    [enabled, entry, inbox, kind],
  );
  return { side, handlers };
}

type Entry = { id: string; title: string };

const LOADING = <p className="text-muted-foreground p-4 text-sm">Loading…</p>;

export function EntryRow({
  kind,
  entry,
  manual,
  children,
}: Readonly<{
  kind: ListKind;
  entry: Entry;
  manual: boolean;
  children: ReactNode;
}>) {
  const drop = useEntryDrag(kind, entry, manual);
  return (
    <li>
      <div
        draggable={manual || kind === 'todos'}
        data-drop={drop.side ?? undefined}
        className="data-[drop=after]:border-b-ring data-[drop=before]:border-t-ring rounded-md border-y-2 border-transparent"
        {...drop.handlers}
      >
        {children}
      </div>
    </li>
  );
}

export function EntryList({
  label,
  empty,
  count,
  children,
}: Readonly<{
  label: string;
  empty: string;
  count: number;
  children: ReactNode;
}>) {
  if (count === 0)
    return <p className="text-muted-foreground p-4 text-sm">{empty}</p>;
  return (
    <ol aria-label={label} className="flex flex-col p-2">
      {children}
    </ol>
  );
}

export function ListBody({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Suspense fallback={LOADING}>{children}</Suspense>
    </div>
  );
}
