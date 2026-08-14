// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Built on pacocoursey/cmdk (MIT), used as a direct dependency rather than
// re-implemented — cmdk's <Command> primitive owns keyboard navigation,
// focus management, and ARIA wiring, which is accessibility-critical code
// not worth re-writing from scratch. What's ARCLUX-specific here is the
// command list itself and how it's wired to navigation.

"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { LayoutDashboard, Network, Search, Settings } from "lucide-react"
import { cn } from "@/lib/cn"
import { useCommandPalette } from "@/hooks/useCommandPalette"

export interface CommandPaletteProps {
  org: string
  repo: string
}

export function CommandPalette({ org, repo }: CommandPaletteProps) {
  // Open-state + keyboard shortcuts (Cmd/Ctrl+K, "/", Escape) moved into
  // the shared hook so other surfaces can reuse the same wiring.
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()
  const base = `/${org}/${repo}`

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
      setOpen(false)
    },
    [router, setOpen]
  )

  if (!open) return null

  const commands = [
    { label: "Overview", href: base, icon: LayoutDashboard },
    { label: "Graph", href: `${base}/graph`, icon: Network },
    { label: "Search", href: `${base}/search`, icon: Search },
    { label: "Settings", href: `${base}/settings`, icon: Settings },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <Command
        className="w-full max-w-md overflow-hidden rounded-lg border bg-popover shadow-lg"
        onClick={(e) => e.stopPropagation()}
        label="Command palette"
      >
        <Command.Input
          autoFocus
          placeholder="Type a command or search..."
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>
          {commands.map(({ label, href, icon: Icon }) => (
            <Command.Item
              key={href}
              onSelect={() => navigate(href)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                "aria-selected:bg-accent aria-selected:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}
