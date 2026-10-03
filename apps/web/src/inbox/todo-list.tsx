import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntryCard } from './entry-card';
import { ArchiveButton } from './entry-actions';
import { EntryList, EntryRow, ListBody } from './entry-list';
import { useOverlay } from './inbox-context';
import { type SortField, sorted } from './inbox-sort';
import { dateTime } from './inbox-time';
import type { TodoSummary } from './core-inbox';
import { ListControls } from './list-controls';
import { type ListSettings, useListSettings } from './list-settings';
import { useEntries } from './use-entries';

const SORT_FIELDS: readonly SortField[] = ['dueAt', 'createdAt', 'updatedAt'];

function todoMeta({ dueAt, createdAt }: TodoSummary): string {
  return dueAt ? `Due ${dateTime(dueAt)}` : `Created ${dateTime(createdAt)}`;
}

function TodoEntry({
  todo,
  manual,
}: Readonly<{ todo: TodoSummary; manual: boolean }>) {
  const show = useOverlay();
  const [open] = useState(() => () => show({ kind: 'todo', id: todo.id }));
  return (
    <EntryCard
      manual={manual}
      title={todo.title}
      preview={todo.preview}
      meta={todoMeta(todo)}
      onOpen={open}
    >
      <ArchiveButton kind="todos" entry={todo} />
    </EntryCard>
  );
}

function Todos({ settings }: Readonly<{ settings: ListSettings }>) {
  const entries = useEntries<TodoSummary>('todos', settings);
  const manual = settings.sort.field === 'position';
  return (
    <EntryList label="To-dos" empty="No to-dos" count={entries.length}>
      {sorted(entries, settings.sort).map((todo) => (
        <EntryRow key={todo.id} kind="todos" entry={todo} manual={manual}>
          <TodoEntry todo={todo} manual={manual} />
        </EntryRow>
      ))}
    </EntryList>
  );
}

export function TodoList() {
  const [settings, change] = useListSettings();
  const show = useOverlay();
  const [create] = useState(() => () => show({ kind: 'new-todo' }));
  return (
    <>
      <ListControls
        noun="to-dos"
        fields={SORT_FIELDS}
        settings={settings}
        change={change}
      >
        <Button variant="outline" onClick={create}>
          <PlusIcon aria-hidden />
          New to-do
        </Button>
      </ListControls>
      <ListBody>
        <Todos settings={settings} />
      </ListBody>
    </>
  );
}
