import { useCallback, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Mosaic } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import { cn } from '@/lib/utils';
import type { Edge, Layout } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';
import { AgentPane } from './agent-pane';

const EDGE_LABELS: Record<Edge, string> = {
  top: 'Add a row at the top',
  bottom: 'Add a row at the bottom',
  left: 'Add a column on the left',
  right: 'Add a column on the right',
};

function EdgeBar({ edge }: Readonly<{ edge: Edge }>) {
  const { workspace } = useWorkspace();
  const add = useCallback(
    () => void workspace.addAtEdge(edge),
    [workspace, edge],
  );
  const across = edge === 'top' || edge === 'bottom';
  return (
    <button
      type="button"
      aria-label={EDGE_LABELS[edge]}
      title={EDGE_LABELS[edge]}
      className={cn(
        'text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 hover:border-border flex items-center justify-center rounded-md border border-dashed border-transparent transition-colors',
        across ? 'col-span-3 h-5' : 'w-5',
      )}
      onClick={add}
    >
      <PlusIcon className="size-3.5" aria-hidden />
    </button>
  );
}

const NO_AGENTS = (
  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
    No agents. Add one from an edge.
  </div>
);

function renderTile(id: string) {
  return <AgentPane id={id} />;
}

export function AgentsView() {
  const { workspace, view } = useWorkspace();
  const [resizing, setResizing] = useState<Layout>();

  const release = useCallback(
    (layout: Layout) => {
      setResizing(undefined);
      void workspace.resize(layout);
    },
    [workspace],
  );

  return (
    <div className="grid h-full grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-1 p-1">
      <EdgeBar edge="top" />
      <EdgeBar edge="left" />
      <div className="relative min-h-0 min-w-0">
        <Mosaic<string>
          className="choir-mosaic"
          value={resizing ?? view.layout}
          onChange={setResizing}
          onRelease={release}
          renderTile={renderTile}
          zeroStateView={NO_AGENTS}
        />
      </div>
      <EdgeBar edge="right" />
      <EdgeBar edge="bottom" />
    </div>
  );
}
