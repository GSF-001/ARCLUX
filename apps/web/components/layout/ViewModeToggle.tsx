// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { Monitor, Smartphone, Sparkles } from "lucide-react"
import {
  useViewModePreference,
  type ViewModePreference,
} from "@/hooks/useViewModePreference"

const NEXT: Record<ViewModePreference, ViewModePreference> = {
  auto: "desktop",
  desktop: "mobile",
  mobile: "auto",
}

const META: Record<ViewModePreference, { icon: typeof Monitor; label: string }> = {
  auto: { icon: Sparkles, label: "Auto layout" },
  desktop: { icon: Monitor, label: "Desktop layout" },
  mobile: { icon: Smartphone, label: "Mobile layout" },
}

/**
 * Cycles Auto → Desktop → Mobile. Persistence + system-width logic live
 * in useViewModePreference; this is the chrome-only trigger.
 */
export function ViewModeToggle() {
  const { preference, setPreference } = useViewModePreference()
  const { icon: Icon, label } = META[preference]

  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[preference])}
      title={`${label} (click to switch)`}
      aria-label={label}
      aria-keyshortcuts="l"
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden font-mono lowercase lg:inline">{preference}</span>
    </button>
  )
}
