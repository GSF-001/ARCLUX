// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Network, Search, Activity, PanelsTopLeft } from "lucide-react"
import { cn } from "@/lib/cn"

interface BottomNavProps {
  org: string
  repo: string
}

const ITEMS = [
  { label: "Overview", icon: LayoutDashboard, suffix: "" },
  { label: "Graph", icon: Network, suffix: "/graph" },
  { label: "Search", icon: Search, suffix: "/search" },
  { label: "Activity", icon: Activity, suffix: "/activity" },
  { label: "Workspace", icon: PanelsTopLeft, suffix: "/workspace" },
]

/**
 * Mobile-only bottom navigation (< 768px, Tailwind `md:hidden`). Mirrors the
 * desktop sidebar links minus Settings, which lives in the Navbar on mobile
 * (one-off page — keeping the bottom bar to the 5 pages users actually
 * switch between, GitHub-Mobile style). Rendered as a flex child of
 * WorkspaceLayout (not `fixed`) so it never overlaps scrollable content or
 * the graph canvas — it simply takes the bottom 4rem of the column. Safe
 * area padding keeps it above the gesture/home bar on notched phones.
 */
export function BottomNav({ org, repo }: BottomNavProps) {
  const pathname = usePathname()
  const base = `/${org}/${repo}`

  return (
    <nav
      aria-label="Primary"
      className="glass-overlay select-none md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-5">
        {ITEMS.map(({ label, icon: Icon, suffix }) => {
          const href = `${base}${suffix}`
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-transform active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
