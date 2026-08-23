// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Built on pacocoursey/cmdk (MIT), used as a direct dependency rather
// than re-implemented — cmdk's <Command> primitive owns keyboard
// navigation, focus management, and ARIA wiring. ARCLUX-specific: the
// command list renders from lib/navigation.ts (same registry as the
// sidebars) plus global destinations, wrapped in motion chrome.

"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { motion } from "motion/react"
import { SquareTerminal, Settings } from "lucide-react"
import { cn } from "@/lib/cn"
import { useCommandPalette } from "@/hooks/useCommandPalette"
import { GLOBAL_ITEMS, NAV_GROUPS } from "@/lib/navigation"

export interface CommandPaletteProps {
  org: string
  repo: string
}

export function CommandPalette({ org, repo }: CommandPaletteProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[16vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient hairline crown */}
        <div className="h-[2px] w-full rounded-t-xl bg-gradient-to-r from-transparent via-primary to-transparent" />
        <Command
          className="glass-panel overflow-hidden rounded-b-xl rounded-t-lg shadow-2xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
          label="Command palette"
        >
          <Command.Input
            autoFocus
            placeholder="Ketik perintah atau cari…"
            className="w-full border-b bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada hasil.
            </Command.Empty>

            {NAV_GROUPS.map((group) => (
              <Command.Group
                key={group.id}
                heading={group.label}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-muted-foreground/60"
              >
                {group.items.map(({ label, suffix, icon: Icon, description }) => {
                  const href = `${base}${suffix}`
                  return (
                    <Command.Item
                      key={href}
                      value={`${label} ${description ?? ""}`}
                      onSelect={() => navigate(href)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                        "aria-selected:bg-accent aria-selected:text-accent-foreground"
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block">{label}</span>
                        {description && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {description}
                          </span>
                        )}
                      </span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            ))}

            <Command.Group
              heading="Global"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-muted-foreground/60"
            >
              {GLOBAL_ITEMS.map(({ label, suffix, icon: Icon, description }) => (
                <Command.Item
                  key={suffix}
                  value={`${label} ${description ?? ""}`}
                  onSelect={() => navigate(suffix)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                    "aria-selected:bg-accent aria-selected:text-accent-foreground"
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block">{label}</span>
                    {description && (
                      <span className="block truncate text-xs text-muted-foreground">{description}</span>
                    )}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center gap-4 border-t border-neutral-800/70 px-4 py-2 font-mono text-[10px] text-muted-foreground/60">
            <span><kbd className="rounded border border-neutral-700 px-1">↑↓</kbd> navigasi</span>
            <span><kbd className="rounded border border-neutral-700 px-1">↵</kbd> buka</span>
            <span className="ml-auto"><kbd className="rounded border border-neutral-700 px-1">esc</kbd> tutup</span>
          </div>
        </Command>
      </motion.div>
    </div>
  )
}

/** Re-exported icons kept for any legacy imports of this module. */
export { SquareTerminal, Settings }
