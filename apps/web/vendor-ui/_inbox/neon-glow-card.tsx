// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type GlowColor = "cyan" | "violet" | "amber" | "rose";

const GLOW_STYLES: Record<GlowColor, { border: string; shadow: string; ring: string }> = {
  cyan: {
    border: "border-cyan-400/40",
    shadow: "shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)]",
    ring: "hover:shadow-[0_0_36px_-2px_rgba(34,211,238,0.65)]",
  },
  violet: {
    border: "border-violet-400/40",
    shadow: "shadow-[0_0_24px_-4px_rgba(167,139,250,0.45)]",
    ring: "hover:shadow-[0_0_36px_-2px_rgba(167,139,250,0.65)]",
  },
  amber: {
    border: "border-amber-400/40",
    shadow: "shadow-[0_0_24px_-4px_rgba(251,191,36,0.45)]",
    ring: "hover:shadow-[0_0_36px_-2px_rgba(251,191,36,0.65)]",
  },
  rose: {
    border: "border-rose-400/40",
    shadow: "shadow-[0_0_24px_-4px_rgba(251,113,133,0.45)]",
    ring: "hover:shadow-[0_0_36px_-2px_rgba(251,113,133,0.65)]",
  },
};

export interface NeonGlowCardProps {
  children: ReactNode;
  glow?: GlowColor;
  /** Only glow on hover instead of always-on — quieter default for dense UIs like the graph panel */
  glowOnHoverOnly?: boolean;
  className?: string;
}

/**
 * A card with a soft neon border glow. Intended for drawing attention to a single
 * selected/important element (e.g. the currently selected node in GraphSelection.tsx),
 * not for decorating every card on the page — the glow reads as emphasis, so overusing
 * it flattens the signal.
 */
export function NeonGlowCard({
  children,
  glow = "cyan",
  glowOnHoverOnly = false,
  className,
}: NeonGlowCardProps) {
  const styles = GLOW_STYLES[glow];

  return (
    <div
      className={cn(
        "rounded-lg border bg-neutral-950/80 backdrop-blur-sm transition-shadow duration-300",
        styles.border,
        glowOnHoverOnly ? styles.ring : styles.shadow,
        className
      )}
    >
      {children}
    </div>
  );
}
