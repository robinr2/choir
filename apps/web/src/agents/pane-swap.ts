import { type DragEvent, useMemo, useState } from 'react';

const AGENT_TYPE = 'application/x-choir-agent';

function ownType(id: string): string {
  return `${AGENT_TYPE}-${id}`;
}

function carriesAnotherAgent(event: DragEvent, id: string): boolean {
  const { types } = event.dataTransfer;
  return types.includes(AGENT_TYPE) && !types.includes(ownType(id));
}

function leftFor(event: DragEvent<HTMLElement>): boolean {
  const next = event.relatedTarget;
  return !(next instanceof Node && event.currentTarget.contains(next));
}

export function startPaneDrag(event: DragEvent<HTMLElement>): void {
  const id = String(event.currentTarget.dataset.agentId);
  event.stopPropagation();
  event.dataTransfer.setData(AGENT_TYPE, id);
  event.dataTransfer.setData(ownType(id), id);
  event.dataTransfer.effectAllowed = 'move';
}

export function usePaneDrop(id: string, swap: (source: string) => void) {
  const [isTarget, setTarget] = useState(false);
  const handlers = useMemo(
    () => ({
      onDragOver: (event: DragEvent) => {
        if (!carriesAnotherAgent(event, id)) return;
        event.preventDefault();
        event.stopPropagation();
        setTarget(true);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (leftFor(event)) setTarget(false);
      },
      onDrop: (event: DragEvent) => {
        if (!carriesAnotherAgent(event, id)) return;
        event.preventDefault();
        event.stopPropagation();
        setTarget(false);
        swap(event.dataTransfer.getData(AGENT_TYPE));
      },
    }),
    [id, swap],
  );
  return { isTarget, handlers };
}
