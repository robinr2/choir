"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { mono } from "./surfaces";
import { announced, clamp } from "../utils/range";

export interface QuotaWindow {
  label: string;
  percent: number;
  resets: string;
}

function QuotaMeter({ label, percent, resets }: QuotaWindow) {
  const shown = clamp(percent, 0, 100);
  const tight = shown >= 90;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          tight && "text-amber-700 dark:text-amber-400",
        )}
      >
        {label}
      </span>
      <span
        role="meter"
        aria-label={`${label} limit used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={announced(shown)}
        aria-valuetext={`${percent}% used, resets ${resets}`}
        className="bg-foreground/[0.06] h-1 min-w-8 flex-1 overflow-hidden rounded-full"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
            tight ? "bg-amber-500" : "bg-foreground/40",
          )}
          style={{ width: `${shown}%` }}
        />
      </span>
      <span className={cn(mono, "text-foreground/60 shrink-0 tabular-nums")}>
        {percent}%
      </span>
      <span className={cn(mono, "text-foreground/30 truncate tabular-nums")}>
        resets {resets}
      </span>
    </div>
  );
}

export function QuotaBanner({
  windows,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  windows: readonly QuotaWindow[];
}) {
  return (
    <div
      data-slot="quota-banner"
      aria-label="Usage limits"
      role="group"
      className={cn("flex w-full items-center gap-4 px-2", className)}
      {...props}
    >
      {windows.map((window) => (
        <QuotaMeter key={window.label} {...window} />
      ))}
    </div>
  );
}
