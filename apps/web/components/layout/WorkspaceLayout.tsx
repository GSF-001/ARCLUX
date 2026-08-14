// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useState } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import type { BreadcrumbItem } from "@/components/layout/Breadcrumbs"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { cn } from "@/lib/cn"

interface WorkspaceLayoutProps {
  org: string
  repo: string
  breadcrumbs: BreadcrumbItem[]
  children: React.ReactNode
}

/**
 * Shared app shell for every /[org]/[repo]/* page, responsive across three
 * breakpoints (Tailwind `md` = 768px, `lg` = 1024px):
 * - Desktop (lg+): inline Sidebar, collapsible to an icon rail via the
 *   Navbar menu button.
 * - Tablet (md–lg): Sidebar becomes a fixed overlay drawer opened by the
 *   same menu button; hidden by default.
 * - Mobile (<md): no sidebar at all — BottomNav takes over navigation;
 *   Settings moves into the Navbar.
 *
 * Visibility is driven by Tailwind responsive classes (hydration-safe); the
 * useBreakpoint hook only decides which action the menu button performs.
 * BottomNav is a flex child (not `fixed`) so it never overlaps content.
 * Borderless premium styling: sidebar uses the `bg-sidebar` token + shadow,
 * the breadcrumbs strip uses `bg-muted/40` — no `border-*` anywhere.
 */
export function WorkspaceLayout({ org, repo, breadcrumbs, children }: WorkspaceLayoutProps) {
  const { isDesktop } = useBreakpoint()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  function handleMenuClick() {
    if (isDesktop) {
      setSidebarCollapsed((c) => !c)
    } else {
      setSidebarOpen((o) => !o)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Navbar
        org={org}
        repo={repo}
        onMenuClick={handleMenuClick}
        menuActive={sidebarOpen}
        scrolled={scrolled}
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop: inline collapsible sidebar. Hidden below lg (CSS). */}
        <div className="hidden lg:block">
          <Sidebar org={org} repo={repo} collapsed={sidebarCollapsed} />
        </div>

        {/* Tablet: overlay drawer. Always mounted so resize to desktop hides
            it via CSS instead of unmounting mid-gesture. */}
        <div
          className={cn(
            "fixed inset-0 z-50 lg:hidden",
            sidebarOpen ? "" : "pointer-events-none invisible"
          )}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar org={org} repo={repo} overlay onClose={() => setSidebarOpen(false)} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="flex-1 overflow-auto"
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 10)}
          >
            {children}
          </div>
        </div>
      </div>

      <BottomNav org={org} repo={repo} />
    </div>
  )
}
