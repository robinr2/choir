import { useState } from 'react';
import { EntryCard } from './entry-card';
import { ArchiveButton, LinkTodoMenu, MakeTodoButton } from './entry-actions';
import { EntryList, EntryRow, ListBody } from './entry-list';
import { useOverlay } from './inbox-context';
import { type SortField, sorted } from './inbox-sort';
import { dateTime } from './inbox-time';
import type { NotificationSummary } from './core-inbox';
import { ListControls } from './list-controls';
import { type ListSettings, useListSettings } from './list-settings';
import { useEntries } from './use-entries';

const SORT_FIELDS: readonly SortField[] = ['sentAt'];

function NotificationEntry({
  notification,
  manual,
}: Readonly<{ notification: NotificationSummary; manual: boolean }>) {
  const show = useOverlay();
  const [open] = useState(
    () => () => show({ kind: 'notification', id: notification.id }),
  );
  return (
    <EntryCard
      manual={manual}
      title={notification.title}
      preview={notification.preview}
      meta={`${notification.source} · ${dateTime(notification.sentAt)}`}
      onOpen={open}
    >
      <MakeTodoButton notification={notification} />
      <LinkTodoMenu notificationId={notification.id} />
      <ArchiveButton kind="notifications" entry={notification} />
    </EntryCard>
  );
}

function Notifications({ settings }: Readonly<{ settings: ListSettings }>) {
  const entries = useEntries<NotificationSummary>('notifications', settings);
  const manual = settings.sort.field === 'position';
  return (
    <EntryList
      label="Notifications"
      empty="No notifications"
      count={entries.length}
    >
      {sorted(entries, settings.sort).map((notification) => (
        <EntryRow
          key={notification.id}
          kind="notifications"
          entry={notification}
          manual={manual}
        >
          <NotificationEntry notification={notification} manual={manual} />
        </EntryRow>
      ))}
    </EntryList>
  );
}

export function NotificationList() {
  const [settings, change] = useListSettings();
  return (
    <>
      <ListControls
        noun="notifications"
        fields={SORT_FIELDS}
        settings={settings}
        change={change}
      />
      <ListBody>
        <Notifications settings={settings} />
      </ListBody>
    </>
  );
}
