"use client";

import type { ComponentProps } from "react";
import { GitForkIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { mono } from "./surfaces";

export interface ThreadItem {
  id: string;
  title: string;
  folder: string;
  time: string;
}

export function ThreadList({
  threads,
  onChoose,
  onFork,
  onDelete,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "threads" | "onChoose" | "onFork" | "onDelete"
> & {
  threads: readonly ThreadItem[];
  onChoose: (thread: ThreadItem) => void;
  onFork?: ((thread: ThreadItem) => void) | undefined;
  onDelete?: ((thread: ThreadItem) => void) | undefined;
}) {
  const hasActions = onFork !== undefined || onDelete !== undefined;
  return (
    <div
      data-slot="thread-list"
      role="list"
      className={cn("flex w-full flex-col gap-0.5", className)}
      {...props}
    >
      {threads.map((thread) => (
        <div
          key={thread.id}
          role="listitem"
          className="group hover:bg-foreground/[0.03] focus-within:bg-foreground/[0.03] relative flex w-full items-center rounded-xl text-[13.5px] transition-colors"
        >
          <button
            type="button"
            onClick={() => onChoose(thread)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-start outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
              hasActions && "group-focus-within:pe-16 group-hover:pe-16",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate">{thread.title}</span>
              <span className={cn(mono, "text-foreground/40 truncate")}>
                {thread.folder}
              </span>
            </span>
            <span
              className={cn(
                mono,
                "text-foreground/35 shrink-0 tabular-nums",
                hasActions && "group-focus-within:hidden group-hover:hidden",
              )}
            >
              {thread.time}
            </span>
          </button>
          {hasActions && (
            <div className="absolute end-2 flex items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
              {onFork && (
                <button
                  type="button"
                  aria-label={`Fork ${thread.title}`}
                  title="Fork"
                  onClick={() => onFork(thread)}
                  className="text-foreground/45 hover:bg-foreground/[0.06] hover:text-foreground/90 rounded-full p-1.5"
                >
                  <GitForkIcon className="size-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  aria-label={`Delete ${thread.title}`}
                  title="Delete"
                  onClick={() => onDelete(thread)}
                  className="text-foreground/45 hover:bg-foreground/[0.06] hover:text-destructive rounded-full p-1.5"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
