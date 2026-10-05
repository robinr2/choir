import { useMemo } from 'react';
import { FileIcon } from 'lucide-react';
import { CodeDiff } from '@/components/assistant-ui/elements/code-diff';
import type { ToolCallPart } from '@/conversation/transcript';
import { shownDiff, shownPath } from './file-diff';
import { useSessionFolder } from './session-folder';

type Diff = ToolCallPart['diffs'][number];

type Location = ToolCallPart['locations'][number];

function lineOf({ line }: Location): string {
  return line === undefined ? '' : `:${line}`;
}

export function ToolLocations({
  locations,
}: Readonly<{ locations: readonly Location[] }>) {
  const folder = useSessionFolder();
  return (
    <div className="flex flex-wrap gap-1 empty:hidden">
      {locations.map((location) => (
        <button
          key={location.path}
          type="button"
          title={location.path}
          className="bg-muted/60 text-muted-foreground hover:text-foreground flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs"
        >
          <FileIcon className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {shownPath(location.path, folder)}
            {lineOf(location)}
          </span>
        </button>
      ))}
    </div>
  );
}

function DiffCard({ diff }: Readonly<{ diff: Diff }>) {
  const folder = useSessionFolder();
  const name = shownPath(diff.path, folder);
  const shown = useMemo(() => shownDiff(diff, name), [diff, name]);
  return <CodeDiff cycle={0} className="max-w-none" {...shown} />;
}

export function ToolDiffs({ diffs }: Readonly<{ diffs: readonly Diff[] }>) {
  return (
    <>
      {diffs.map((diff) => (
        <DiffCard key={diff.path} diff={diff} />
      ))}
    </>
  );
}
