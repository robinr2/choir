"use client";

import type { ComponentProps, ReactNode, Ref } from "react";
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { paper } from "./surfaces";

function indent(depth: number) {
  return { paddingInlineStart: `${0.25 + depth * 0.85}rem` };
}

export function FileTree({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="file-tree"
      role="tree"
      className={cn(
        paper,
        "flex w-full flex-col overflow-y-auto rounded-2xl p-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function FileTreeFolder({
  name,
  path,
  depth,
  expanded,
  selected,
  onToggle,
  onSelect,
  ref,
  children,
}: {
  name: string;
  path: string;
  depth: number;
  expanded: boolean;
  selected: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  ref?: Ref<HTMLDivElement> | undefined;
  children?: ReactNode;
}) {
  const Icon = expanded ? FolderOpenIcon : FolderIcon;
  return (
    <div role="treeitem" aria-expanded={expanded} aria-selected={selected}>
      <div
        ref={ref}
        className={cn(
          "group flex items-center gap-1 rounded-lg py-0.5 pe-1 text-[13px] transition-colors",
          selected
            ? "bg-foreground/[0.07] text-foreground"
            : "hover:bg-foreground/[0.03]",
        )}
        style={indent(depth)}
      >
        <button
          type="button"
          aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
          onClick={() => onToggle(path)}
          className="text-foreground/35 hover:text-foreground/80 flex size-5 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
        >
          <ChevronRightIcon
            className={cn(
              "size-3 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(path)}
          onDoubleClick={() => onToggle(path)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-start outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
        >
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              selected ? "text-foreground/70" : "text-foreground/35",
            )}
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              selected ? "font-medium" : "text-foreground/75",
            )}
          >
            {name}
          </span>
        </button>
      </div>
      {expanded && (
        <div
          role="group"
          style={{ ["--file-tree-depth" as string]: depth + 1 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function FileTreeNote({ children }: { children: ReactNode }) {
  return (
    <div className="text-foreground/35 py-1 ps-[calc(1.75rem+var(--file-tree-depth)*0.85rem)] pe-1 text-xs">
      {children}
    </div>
  );
}
