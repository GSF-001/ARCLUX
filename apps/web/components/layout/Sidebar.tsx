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
import { motion } from "motion/react"
import { X } from "lucide-react"
import { cn } from "@/lib/cn"
import { NAV_GROUPS, GLOBAL_ITEMS } from "@/lib/navigation"

interface SidebarProps {
  org: string
  repo: string
  collapsed?: boolean
  overlay?: boolean
  onClose?: () => void
}

/**
 * Desktop/tablet navigation rail. Renders from lib/navigation.ts — the
 * single nav registry shared with BottomNav and CommandPalette.
 *
 * Eye-candy contract: glass surface, group micro-labels, and a sliding
 * active pill (motion layoutId) so selection glides between items
 * instead of teleporting.
 */
export function Sidebar({ org, repo, collapsed = false, overlay = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const base = `/${org}/${repo}`

  const renderGroup = (groupId: string, label: string, items: typeof NAV_GROUPS[number]["items"]) => (
    <div key={groupId} className="px-2">
      {!collapsed && (
        <p className="mb-1 px-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map(({ label: itemLabel, suffix, icon: Icon, description }) => {
          const href = `${base}${suffix}`
          const isActive = pathname === href
          return (
            <li key={href} className="relative">
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/15 via-primary/10 to-transparent ring-1 ring-inset ring-primary/30"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Link
                href={href}
                title={collapsed ? itemLabel : description ?? itemLabel}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md py-2 text-sm font-medium transition-colors duration-150",
                  collapsed ? "justify-center px-0" : "px-2",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* left glow hairline on active */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_2px] shadow-primary/40" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                    isActive && "text-primary drop-shadow-[0_0_6px_rgba(0,112,243,0.6)]"
                  )}
                />
                {!collapsed && <span className="truncate">{itemLabel}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 text-sidebar-foreground select-none transition-all duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        collapsed ? "w-16" : "w-60",
        overlay ? "glass-overlay" : "glass-panel"
      )}
    >
      {overlay && (
        <div className="mb-1 flex items-center justify-between px-2 pt-1">
          <span className="text-sm font-semibold">Navigasi</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup navigasi"
            className="rounded-md p-2 transition-transform hover:bg-accent active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {NAV_GROUPS.map((g) => renderGroup(g.id, g.label, g.items))}
      {renderGroup("global", "Global", GLOBAL_ITEMS)}

      {!collapsed && (
        <p className="mt-auto px-3 pb-2 font-mono text-[10px] text-muted-foreground/40">
          arclux · v0.2.0
        </p>
      )}
    </aside>
  )
}