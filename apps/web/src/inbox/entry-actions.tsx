import { Suspense, use, useCallback, useDeferredValue } from 'react';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  LinkIcon,
  ListTodoIcon,
} from 'lucide-react';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { listPath } from './core-inbox';
import { useInbox, useOverlay } from './inbox-context';
import type { ListKind, NotificationSummary, TodoSummary } from './core-inbox';

const LINK_TRIGGER = (
  <Button
    variant="ghost"
    size="icon-sm"
    aria-label="Add to to-do"
    title="Add to to-do"
  />
);

const LOADING = <DropdownMenuItem disabled>Loading…</DropdownMenuItem>;

const ACTIVE_TODOS = listPath('todos', { archived: false, search: '' });

export function ArchiveButton({
  kind,
  entry,
}: Readonly<{
  kind: ListKind;
  entry: { id: string; archivedAt: string | null };
}>) {
  const { inbox } = useInbox();
  const archived = entry.archivedAt !== null;
  const toggle = useCallback(
    () => void inbox.archive(kind, entry.id, !archived),
    [inbox, kind, entry.id, archived],
  );
  return (
    <TooltipIconButton
      tooltip={archived ? 'Restore' : 'Archive'}
      className="size-7"
      onClick={toggle}
    >
      {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
    </TooltipIconButton>
  );
}

export function MakeTodoButton({
  notification,
}: Readonly<{ notification: NotificationSummary }>) {
  const show = useOverlay();
  const make = useCallback(
    () => show({ kind: 'new-todo', from: notification }),
    [show, notification],
  );
  return (
    <TooltipIconButton tooltip="Make to-do" className="size-7" onClick={make}>
      <ListTodoIcon />
    </TooltipIconButton>
  );
}

function TodoItem({
  todo,
  notificationId,
}: Readonly<{ todo: TodoSummary; notificationId: string }>) {
  const { inbox } = useInbox();
  const link = useCallback(
    () => void inbox.link(todo.id, notificationId),
    [inbox, todo.id, notificationId],
  );
  return <DropdownMenuItem onClick={link}>{todo.title}</DropdownMenuItem>;
}

function ActiveTodos({ notificationId }: Readonly<{ notificationId: string }>) {
  const { inbox, snapshot } = useInbox();
  const revision = useDeferredValue(snapshot.revision);
  const todos = use(inbox.read<TodoSummary[]>(ACTIVE_TODOS, revision));
  if (todos.length === 0)
    return <DropdownMenuItem disabled>No active to-dos</DropdownMenuItem>;
  return todos.map((todo) => (
    <TodoItem key={todo.id} todo={todo} notificationId={notificationId} />
  ));
}

export function LinkTodoMenu({
  notificationId,
}: Readonly<{ notificationId: string }>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={LINK_TRIGGER}>
        <LinkIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-72">
        <Suspense fallback={LOADING}>
          <ActiveTodos notificationId={notificationId} />
        </Suspense>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
