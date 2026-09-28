import { type ReactNode, Suspense, useReducer, useState } from 'react';
import { BellIcon, ListTodoIcon } from 'lucide-react';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ListKind } from './core-inbox';
import { type Overlay, OverlayContext } from './inbox-context';
import { NotificationOverlay } from './notification-overlay';
import { NewTodoOverlay, TodoOverlay } from './todo-overlay';

const LOADING = <p className="text-muted-foreground text-sm">Loading…</p>;

type Show = (overlay: Overlay | null | boolean) => void;

function overlayed(
  _: Overlay | null,
  action: Overlay | null | boolean,
): Overlay | null {
  return typeof action === 'object' ? action : null;
}

function OverlayContent({
  overlay,
  show,
}: Readonly<{ overlay: Overlay; show: Show }>) {
  if (overlay.kind === 'notification')
    return <NotificationOverlay id={overlay.id} />;
  if (overlay.kind === 'todo')
    return <TodoOverlay id={overlay.id} show={show} />;
  return <NewTodoOverlay from={overlay.from} show={show} />;
}

function InboxOverlay({
  overlay,
  show,
}: Readonly<{ overlay: Overlay | null; show: Show }>) {
  return (
    <Dialog open={overlay !== null} onOpenChange={show}>
      <DialogContent className="sm:max-w-lg">
        <Suspense fallback={LOADING}>
          {overlay && (
            <OverlayContent
              key={JSON.stringify(overlay)}
              overlay={overlay}
              show={show}
            />
          )}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

const LABELS: Record<ListKind, string> = {
  todos: 'To-dos',
  notifications: 'Notifications',
};

const ICONS: Record<ListKind, ReactNode> = {
  todos: <ListTodoIcon />,
  notifications: <BellIcon />,
};

function ListButton({
  kind,
  shown,
  show,
}: Readonly<{
  kind: ListKind;
  shown: ListKind;
  show: (kind: ListKind) => void;
}>) {
  const [pick] = useState(() => () => show(kind));
  return (
    <TooltipIconButton
      tooltip={LABELS[kind]}
      aria-pressed={shown === kind}
      className="aria-pressed:bg-sidebar-accent size-8"
      onClick={pick}
    >
      {ICONS[kind]}
    </TooltipIconButton>
  );
}

function ListSection({
  kind,
  shown,
  children,
}: Readonly<{ kind: ListKind; shown: ListKind; children: ReactNode }>) {
  return (
    <section
      aria-label={LABELS[kind]}
      hidden={shown !== kind}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </section>
  );
}

export function InboxPanel({
  lists,
}: Readonly<{ lists: Record<ListKind, ReactNode> }>) {
  const [shown, setShown] = useState<ListKind>('todos');
  const [overlay, show] = useReducer(overlayed, null);
  return (
    <OverlayContext value={show}>
      <aside
        aria-label="Inbox"
        className="bg-sidebar border-sidebar-border flex w-96 shrink-0 flex-col border-l"
      >
        <div className="border-border/60 flex items-center gap-1 border-b p-2">
          <ListButton kind="todos" shown={shown} show={setShown} />
          <ListButton kind="notifications" shown={shown} show={setShown} />
          <h2 className="ms-1 text-sm font-medium">{LABELS[shown]}</h2>
        </div>
        <ListSection kind="todos" shown={shown}>
          {lists.todos}
        </ListSection>
        <ListSection kind="notifications" shown={shown}>
          {lists.notifications}
        </ListSection>
      </aside>
      <InboxOverlay overlay={overlay} show={show} />
    </OverlayContext>
  );
}
