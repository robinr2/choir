import type { DataMessagePartComponent } from '@assistant-ui/react';
import { ChevronRightIcon, Loader2Icon, ShrinkIcon, XIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CompactionPart } from '@/conversation/transcript';
import { MarkdownBlock } from './markdown-block';

const SHOWN = {
  in_progress: {
    label: 'Compacting conversation…',
    icon: <Loader2Icon className="size-3.5 animate-spin" aria-hidden />,
  },
  completed: {
    label: 'Conversation compacted',
    icon: <ShrinkIcon className="size-3.5" aria-hidden />,
  },
  failed: {
    label: 'Compaction failed',
    icon: <XIcon className="size-3.5" aria-hidden />,
  },
  cancelled: {
    label: 'Compaction cancelled',
    icon: <XIcon className="size-3.5" aria-hidden />,
  },
} as const;

const RULE = <span aria-hidden className="bg-border h-px min-w-4 flex-1" />;

function Compaction({ part }: Readonly<{ part: CompactionPart }>) {
  const { label, icon } = SHOWN[part.status];
  return (
    <Collapsible className="my-3 flex flex-col gap-2" data-slot="compaction">
      <output className="text-muted-foreground flex items-center gap-2 text-xs">
        {RULE}
        {icon}
        <span>{label}</span>
        {part.summary && (
          <CollapsibleTrigger className="hover:text-foreground group flex items-center gap-0.5">
            Summary
            <ChevronRightIcon
              aria-hidden
              className="size-3.5 transition-transform group-data-panel-open:rotate-90"
            />
          </CollapsibleTrigger>
        )}
        {RULE}
      </output>
      <CollapsibleContent>
        <MarkdownBlock text={part.summary} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export const CompactionData: DataMessagePartComponent<CompactionPart> = ({
  data,
}) => <Compaction part={data} />;
