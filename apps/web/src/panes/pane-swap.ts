import { type DragEvent, useMemo, useState } from 'react';
import { useWorkspace } from '@/workspace/workspace-context';

const PANE_TYPE = 'application/x-choir-pane';

function ownType(id: string): string {
  return `${PANE_TYPE}-${id}`;
}

function carriesAnotherPane(event: DragEvent, id: string): boolean {
  const { types } = event.dataTransfer;
  return types.includes(PANE_TYPE) && !types.includes(ownType(id));
}

export function leftFor(event: DragEvent<HTMLElement>): boolean {
  const next = event.relatedTarget;
  return !(next instanceof Node && event.currentTarget.contains(next));
}

export function startPaneDrag(event: DragEvent<HTMLElement>): void {
  const id = String(event.currentTarget.dataset.paneId);
  event.stopPropagation();
  event.dataTransfer.setData(PANE_TYPE, id);
  event.dataTransfer.setData(ownType(id), id);
  event.dataTransfer.effectAllowed = 'move';
}

export function usePaneDrop(id: string) {
  const { workspace } = useWorkspace();
  const [isTarget, setTarget] = useState(false);
  const handlers = useMemo(
    () => ({
      onDragOver: (event: DragEvent) => {
        if (!carriesAnotherPane(event, id)) return;
        event.preventDefault();
        event.stopPropagation();
        setTarget(true);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (leftFor(event)) setTarget(false);
      },
      onDrop: (event: DragEvent) => {
        if (!carriesAnotherPane(event, id)) return;
        event.preventDefault();
        event.stopPropagation();
        setTarget(false);
        void workspace.swap(event.dataTransfer.getData(PANE_TYPE), id);
      },
    }),
    [id, workspace],
  );
  return { isTarget, handlers };
}
