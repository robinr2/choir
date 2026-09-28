import { BellIcon, InboxIcon, ListTodoIcon } from 'lucide-react';
import { useInbox } from './inbox-context';

function Count({
  label,
  count,
  children,
}: Readonly<{ label: string; count: number; children: React.ReactNode }>) {
  return (
    <output
      aria-label={`${count} active ${label}`}
      data-active={count > 0}
      className="text-muted-foreground data-[active=true]:text-foreground flex items-center gap-0.5 text-[0.65rem] tabular-nums data-[active=true]:font-medium"
    >
      {children}
      {count}
    </output>
  );
}

export function InboxButton({
  open,
  onToggle,
}: Readonly<{ open: boolean; onToggle: () => void }>) {
  const { snapshot } = useInbox();
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-pressed={open}
        title="Inbox"
        className="aria-pressed:bg-sidebar-accent aria-pressed:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 flex size-9 items-center justify-center rounded-md"
        onClick={onToggle}
      >
        <InboxIcon className="size-4" aria-hidden />
        <span className="sr-only">Inbox</span>
      </button>
      <Count label="notifications" count={snapshot.notifications}>
        <BellIcon className="size-3" aria-hidden />
      </Count>
      <Count label="to-dos" count={snapshot.todos}>
        <ListTodoIcon className="size-3" aria-hidden />
      </Count>
    </div>
  );
}
