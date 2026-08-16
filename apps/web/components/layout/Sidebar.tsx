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
import { LayoutDashboard, Network, Search, Settings, PanelsTopLeft, Activity, X } from "lucide-react"
import { cn } from "@/lib/cn"

interface SidebarProps {
  org: string
  repo: string
  /** Desktop inline mode: collapsed to a bare icon rail (w-16). */
  collapsed?: boolean
  /** Tablet overlay mode: rendered in a fixed drawer, shows a close button. */
  overlay?: boolean
  /** Called when the user asks to close the overlay drawer. */
  onClose?: () => void
}

/**
 * Navigation sidebar, rendered by WorkspaceLayout in one of two modes:
 * - Desktop (inline, `hidden lg:block` wrapper): `w-64`, collapsible to a
 *   `w-16` icon rail. Width animates via `transition-all duration-300`.
 * - Tablet (overlay): WorkspaceLayout wraps this in a `fixed` drawer with
 *   a backdrop; `overlay` adds the close button. Not rendered on mobile —
 *   BottomNav owns navigation there.
 *
 * Premium styling: no `border-r` — separation from the content column comes
 * from the sidebar background token (`bg-sidebar`) plus a soft shadow.
 */
export function Sidebar({ org, repo, collapsed = false, overlay = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const base = `/${org}/${repo}`

  const links = [
    { label: "Overview", href: base, icon: LayoutDashboard },
    { label: "Graph", href: `${base}/graph`, icon: Network },
    { label: "Search", href: `${base}/search`, icon: Search },
    { label: "Activity", href: `${base}/activity`, icon: Activity },
    { label: "Workspace", href: `${base}/workspace`, icon: PanelsTopLeft },
    { label: "Settings", href: `${base}/settings`, icon: Settings },
  ]

  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-1 overflow-hidden p-3 text-sidebar-foreground select-none transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        overlay ? "glass-overlay" : "glass-panel"
      )}
    >
      {overlay && (
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-sm font-semibold">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 transition-transform hover:bg-accent active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {links.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href

        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.98]",
              collapsed && "justify-center px-0",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        )
      })}
    </aside>
  )
}
