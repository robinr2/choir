import type { ReactNode } from 'react';
import { GripVerticalIcon } from 'lucide-react';

const GRIP = (
  <GripVerticalIcon
    aria-label="Drag to reorder"
    className="text-muted-foreground/60 mt-0.5 size-3.5 shrink-0 cursor-grab"
  />
);

type EntryText = { title: string; preview: string; meta: string };

function Text({ title, preview, meta }: Readonly<EntryText>) {
  return (
    <>
      <span className="block truncate text-sm font-medium">{title}</span>
      <span className="text-muted-foreground block text-xs">{preview}</span>
      <span className="text-muted-foreground/80 block text-xs">{meta}</span>
    </>
  );
}

export function EntryCard({
  manual,
  onOpen,
  children,
  ...text
}: Readonly<
  EntryText & { manual: boolean; onOpen: () => void; children: ReactNode }
>) {
  return (
    <article
      aria-label={text.title}
      className="hover:bg-accent/40 flex items-start gap-1 rounded-md px-1 py-1.5"
    >
      {manual && GRIP}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onOpen}
      >
        <Text {...text} />
      </button>
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </article>
  );
}
