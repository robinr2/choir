import {
  type FocusEvent,
  type KeyboardEvent,
  useReducer,
  useState,
} from 'react';
import { useWorkspace } from '@/workspace/workspace-context';

function selectOnMount(input: HTMLInputElement | null): void {
  input?.select();
}

function flip(open: boolean): boolean {
  return !open;
}

type Workspace = ReturnType<typeof useWorkspace>['workspace'];

function nameEditor(
  workspace: Workspace,
  id: string,
  name: string,
  onDone: () => void,
) {
  const save = (input: HTMLInputElement) => {
    onDone();
    const typed = input.value.trim();
    if (typed && typed !== name) void workspace.rename(id, typed);
  };
  return {
    onBlur: (event: FocusEvent<HTMLInputElement>) => save(event.currentTarget),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') save(event.currentTarget);
      if (event.key === 'Escape') onDone();
    },
  };
}

function PaneNameInput({
  id,
  name,
  onDone,
}: Readonly<{ id: string; name: string; onDone: () => void }>) {
  const { workspace } = useWorkspace();
  const [editor] = useState(() => nameEditor(workspace, id, name, onDone));
  return (
    <input
      aria-label="Agent name"
      className="bg-input/30 border-input focus-visible:border-ring h-6 w-40 min-w-0 rounded-md border px-1.5 text-sm outline-none"
      defaultValue={name}
      maxLength={40}
      ref={selectOnMount}
      onBlur={editor.onBlur}
      onKeyDown={editor.onKeyDown}
    />
  );
}

export function PaneName({ id, name }: Readonly<{ id: string; name: string }>) {
  const [editing, toggle] = useReducer(flip, false);

  if (editing) return <PaneNameInput id={id} name={name} onDone={toggle} />;
  return (
    <button
      type="button"
      title="Rename"
      className="hover:bg-accent/60 truncate rounded-md px-1.5 py-0.5 text-sm font-medium"
      onClick={toggle}
    >
      {name}
    </button>
  );
}
