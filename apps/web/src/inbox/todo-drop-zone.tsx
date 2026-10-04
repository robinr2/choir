import { type DragEvent, type ReactNode, useMemo, useState } from 'react';
import { useAui } from '@assistant-ui/react';
import { leftFor } from '@/lib/left-for';
import { useInbox } from './inbox-context';
import { type DraggedTodo, TODO_TYPE, todoReference } from './todo-reference';

function carriesTodo(event: DragEvent): boolean {
  if (!event.dataTransfer.types.includes(TODO_TYPE)) return false;
  event.preventDefault();
  return true;
}

function droppedTodo(event: DragEvent): DraggedTodo {
  return JSON.parse(event.dataTransfer.getData(TODO_TYPE));
}

function useTodoDrop() {
  const aui = useAui();
  const { inbox } = useInbox();
  const [isTarget, setTarget] = useState(false);
  const handlers = useMemo(
    () => ({
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (carriesTodo(event)) setTarget(true);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (leftFor(event)) setTarget(false);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!carriesTodo(event)) return;
        setTarget(false);
        const todo = droppedTodo(event);
        const typed = aui.composer().getState().text.trimEnd();
        aui
          .composer()
          .setText([typed, todoReference(todo)].filter(Boolean).join(' '));
        void inbox.archive('todos', todo.id, true);
      },
    }),
    [aui, inbox],
  );
  return { isTarget, handlers };
}

export function TodoDropZone({ children }: Readonly<{ children: ReactNode }>) {
  const drop = useTodoDrop();
  return (
    <div
      className="h-full data-[todo-target=true]:ring-2 data-[todo-target=true]:ring-ring/40 data-[todo-target=true]:ring-inset"
      data-todo-target={drop.isTarget}
      {...drop.handlers}
    >
      {children}
    </div>
  );
}
