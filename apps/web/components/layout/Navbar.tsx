// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import Link from "next/link"
import { Moon, Sun, PanelLeft, Settings } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs"

interface NavbarProps {
  org: string
  repo: string
  /** Tablet: opens the sidebar overlay drawer. Desktop: toggles the inline collapse. */
  onMenuClick?: () => void
  /** Highlights the menu button while the overlay drawer is open. */
  menuActive?: boolean
  /** True once the page content scrolled past 10px — switches the header to glass. */
  scrolled?: boolean
  /** Rendered inline next to the logo, replacing the old separate breadcrumb strip. */
  breadcrumbs?: BreadcrumbItem[]
}

/**
 * Top bar. No bottom border — the transition to the breadcrumbs strip below
 * is a background-tone difference (breadcrumbs zone uses `bg-muted/40`),
 * matching the borderless premium look. The menu button is hidden below
 * `md` (mobile uses BottomNav), the Settings link is hidden above `md`
 * (it lives in the sidebar there). Icon buttons grow to 44px on mobile for
 * touch targets (Apple HIG), staying compact on desktop.
 */
export function Navbar({ org, repo, onMenuClick, menuActive = false, scrolled = false, breadcrumbs }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const settingsHref = `/${org}/${repo}/settings`

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-2 px-4",
        scrolled ? "glass-topbar" : "bg-background"
      )}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          aria-expanded={menuActive}
          className="hidden size-11 md:flex md:size-8 active:scale-95"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Link href="/" className="px-2 text-sm font-semibold tracking-tight shrink-0">
          Arclux
        </Link>
        <Link
          href="/script"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Script
        </Link>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <Breadcrumbs items={breadcrumbs} className="min-w-0" />
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={settingsHref}
          aria-label="Settings"
          className="rounded-md p-2.5 text-muted-foreground transition-transform hover:text-foreground active:scale-95 md:hidden"
        >
          <Settings className="h-5 w-5" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="size-11 md:size-8 active:scale-95"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
