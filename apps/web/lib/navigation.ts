// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Single source of truth for repo-scoped navigation. Every surface —
// desktop sidebar, mobile bottom bar, More sheet, command palette —
// renders from this registry, so adding a feature means adding ONE
// entry and it appears everywhere consistently.

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ClipboardCheck,
  LayoutDashboard,
  Network,
  PanelsTopLeft,
  Search,
  Settings,
  SquareTerminal,
} from "lucide-react"

export interface NavItem {
  label: string
  /** Path appended to /{org}/{repo}. "" = the overview page itself. */
  suffix: string
  icon: LucideIcon
  description?: string
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

/** Repo-scoped groups, rendered top-to-bottom everywhere. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "analisis",
    label: "Explore",
    items: [
      { label: "Graph", suffix: "/graph", icon: Network, description: "Interactive dependency map" },
      { label: "Search", suffix: "/search", icon: Search, description: "Find symbols & files" },
      { label: "Audit", suffix: "/audit", icon: ClipboardCheck, description: "Finding theater: security & health" },
    ],
  },
  {
    id: "repositori",
    label: "Inspect",
    items: [
      { label: "Overview", suffix: "", icon: LayoutDashboard, description: "Repository summary" },
      { label: "Activity", suffix: "/activity", icon: Activity, description: "Commits & contributors" },
      { label: "Workspace", suffix: "/workspace", icon: PanelsTopLeft, description: "Files · impact · issues panels" },
    ],
  },
]

/** Global destinations outside the org/repo scope. */
export const GLOBAL_ITEMS: NavItem[] = [
  {
    label: "Script Playground",
    suffix: "/script",
    icon: SquareTerminal,
    description: "opencode-style DSL terminal",
  },
  { label: "Settings", suffix: "/settings", icon: Settings, description: "Display preferences" },
]
