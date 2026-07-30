"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface KeyboardShortcutHintProps {
  /** e.g. ["cmd", "k"] renders as a "cmd" key + "k" key joined by a plus sign */
  keys: string[];
  className?: string;
}

/** Renders common key names as their symbol on Mac, otherwise the plain label */
function renderKeyLabel(key: string): string {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform ?? navigator.userAgent);

  const macSymbols: Record<string, string> = {
    cmd: "⌘",
    ctrl: "⌃",
    shift: "⇧",
    alt: "⌥",
    option: "⌥",
    enter: "↵",
    esc: "⎋",
  };

  const normalized = key.toLowerCase();
  if (isMac && macSymbols[normalized]) return macSymbols[normalized];
  if (!isMac && normalized === "cmd") return "Ctrl";
  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * A row of <kbd> keys, e.g. for CommandPalette.tsx ("⌘K to open") or as a tooltip
 * suffix on toolbar buttons (GraphToolbar.tsx). Renders Mac symbols vs plain labels
 * based on the user's platform.
 */
export function KeyboardShortcutHint({ keys, className }: KeyboardShortcutHintProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((key, i) => (
        <Fragment key={`${key}-${i}`}>
          <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] leading-none text-neutral-300 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
            {renderKeyLabel(key)}
          </kbd>
          {i < keys.length - 1 && <span className="text-[10px] text-neutral-600">+</span>}
        </Fragment>
      ))}
    </span>
  );
}
