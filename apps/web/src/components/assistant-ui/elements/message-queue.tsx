"use client";

import {
  ComposerPrimitive,
  QueueItemPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { CornerDownRightIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { field, ghostButton, mono } from "./surfaces";

export function MessageQueue({ className }: { className?: string }) {
  const queueLength = useAuiState((s) => s.composer.queue.length);

  if (queueLength === 0) return null;

  return (
    <div
      data-slot="message-queue"
      className={cn("flex w-full flex-col gap-1.5", className)}
    >
      <div className="flex items-baseline justify-between px-1">
        <span className={cn(mono, "text-foreground/35")}>
          {queueLength} queued
        </span>
        <span className={cn(mono, "text-foreground/35")}>
          sends when this turn finishes
        </span>
      </div>
      <ul aria-label="Queued messages" className="flex flex-col gap-1.5">
        <ComposerPrimitive.Queue>
          {({ queueItem }) => (
            <li
              key={queueItem.id}
              className={cn(
                field,
                "fade-in slide-in-from-bottom-1 animate-in fill-mode-both flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-3 duration-300",
              )}
            >
              <span className="text-foreground/60 min-w-0 flex-1 truncate text-[13.5px]">
                <QueueItemPrimitive.Text />
              </span>
              <QueueItemPrimitive.Steer
                aria-label="Steer into the running turn"
                title="Steer into the running turn"
                className={cn(ghostButton, "size-6 shrink-0")}
              >
                <CornerDownRightIcon className="size-3.5" />
              </QueueItemPrimitive.Steer>
              <QueueItemPrimitive.Remove
                aria-label="Remove from queue"
                title="Remove from queue"
                className={cn(ghostButton, "size-6 shrink-0")}
              >
                <XIcon className="size-3.5" />
              </QueueItemPrimitive.Remove>
            </li>
          )}
        </ComposerPrimitive.Queue>
      </ul>
    </div>
  );
}
