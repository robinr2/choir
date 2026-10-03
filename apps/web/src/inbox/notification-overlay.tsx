import { use, useDeferredValue, useMemo } from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Attachments } from './attachments';
import { ArchiveButton, LinkTodoMenu, MakeTodoButton } from './entry-actions';
import { useInbox } from './inbox-context';
import { dateTime } from './inbox-time';
import type { NotificationDetail } from './core-inbox';

function OriginalLink({ link }: Readonly<{ link: string | null }>) {
  if (!link) return <span className="me-auto" />;
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="text-primary me-auto inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
    >
      <ExternalLinkIcon className="size-3.5" aria-hidden />
      Open original
    </a>
  );
}

function Content({
  notification,
}: Readonly<{ notification: NotificationDetail }>) {
  const files = useMemo(
    () =>
      notification.attachments.map((file) => ({
        notificationId: notification.id,
        ...file,
      })),
    [notification],
  );
  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
      <p className="text-sm whitespace-pre-wrap">{notification.text}</p>
      <Attachments files={files} />
    </div>
  );
}

export function NotificationOverlay({ id }: Readonly<{ id: string }>) {
  const { inbox, snapshot } = useInbox();
  const revision = useDeferredValue(snapshot.revision);
  const notification = use(
    inbox.read<NotificationDetail>(`/notifications/${id}`, revision),
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle>{notification.title}</DialogTitle>
        <DialogDescription>
          {notification.source} · {dateTime(notification.sentAt)}
        </DialogDescription>
      </DialogHeader>
      <Content notification={notification} />
      <DialogFooter className="flex-row items-center">
        <OriginalLink link={notification.link} />
        <MakeTodoButton notification={notification} />
        <LinkTodoMenu notificationId={id} />
        <ArchiveButton kind="notifications" entry={notification} />
      </DialogFooter>
    </>
  );
}
