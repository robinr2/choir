import { use, useCallback, useDeferredValue, useState } from 'react';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Attachments } from './attachments';
import { ArchiveButton } from './entry-actions';
import { useInbox, useOverlay } from './inbox-context';
import { dateTime } from './inbox-time';
import type { NotificationSummary, TodoDetail, TodoDraft } from './core-inbox';
import { TodoEditor } from './todo-editor';

type Linked = TodoDetail['notifications'][number];

function LinkedNotification({
  notification,
}: Readonly<{ notification: Linked }>) {
  const show = useOverlay();
  const [open] = useState(
    () => () => show({ kind: 'notification', id: notification.id }),
  );
  return (
    <li>
      <button
        type="button"
        className="hover:bg-accent/60 w-full rounded-md px-2 py-1 text-left"
        onClick={open}
      >
        <span className="block truncate text-sm">{notification.title}</span>
        <span className="text-muted-foreground block text-xs">
          {notification.source} · {dateTime(notification.sentAt)}
        </span>
      </button>
    </li>
  );
}

function LinkedNotifications({ todo }: Readonly<{ todo: TodoDetail }>) {
  if (todo.notifications.length === 0) return null;
  return (
    <ul aria-label="Linked notifications" className="mt-2 flex flex-col gap-1">
      {todo.notifications.map((notification) => (
        <LinkedNotification key={notification.id} notification={notification} />
      ))}
    </ul>
  );
}

function TodoHeader({ todo }: Readonly<{ todo: TodoDetail }>) {
  return (
    <>
      <DialogHeader className="flex-row items-center gap-2 pe-8">
        <DialogTitle className="truncate">{todo.title}</DialogTitle>
        <ArchiveButton kind="todos" entry={todo} />
      </DialogHeader>
      <p className="text-muted-foreground text-xs">
        Created {dateTime(todo.createdAt)} · Last change{' '}
        {dateTime(todo.updatedAt)}
      </p>
    </>
  );
}

function NewTodoHeader({ from }: Readonly<{ from?: NotificationSummary }>) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>New to-do</DialogTitle>
      </DialogHeader>
      {from && (
        <p className="text-muted-foreground text-xs">
          From {from.source}: {from.title}
        </p>
      )}
    </>
  );
}

export function TodoOverlay({
  id,
  show,
}: Readonly<{ id: string; show: (overlay: null) => void }>) {
  const { inbox, snapshot } = useInbox();
  const todo = use(
    inbox.read<TodoDetail>(`/todos/${id}`, useDeferredValue(snapshot.revision)),
  );
  const save = useCallback(
    async (draft: TodoDraft) => {
      await inbox.updateTodo(id, draft);
      show(null);
    },
    [inbox, id, show],
  );
  return (
    <>
      <TodoHeader todo={todo} />
      <TodoEditor draft={todo} save={save}>
        <Attachments files={todo.attachments} />
        <LinkedNotifications todo={todo} />
      </TodoEditor>
    </>
  );
}

export function NewTodoOverlay({
  from,
  show,
}: Readonly<{
  from?: NotificationSummary;
  show: (overlay: null) => void;
}>) {
  const { inbox } = useInbox();
  const [draft] = useState(() => ({
    title: from?.title ?? '',
    description: '',
    dueAt: null,
  }));
  const save = useCallback(
    async (todo: TodoDraft) => {
      await inbox.createTodo({
        ...todo,
        notificationIds: from ? [from.id] : [],
      });
      show(null);
    },
    [inbox, from, show],
  );
  return (
    <>
      <NewTodoHeader from={from} />
      <TodoEditor draft={draft} save={save} />
    </>
  );
}
