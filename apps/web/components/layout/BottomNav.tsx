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
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { LayoutDashboard, MoreHorizontal, Network, ClipboardCheck } from "lucide-react"
import { cn } from "@/lib/cn"
import { GLOBAL_ITEMS, NAV_GROUPS } from "@/lib/navigation"

interface BottomNavProps {
  org: string
  repo: string
}

/** The four destinations that earn permanent bottom-bar real estate. */
const FIXED = [
  { label: "Home", icon: LayoutDashboard, suffix: "" },
  { label: "Graph", icon: Network, suffix: "/graph" },
  { label: "Audit", icon: ClipboardCheck, suffix: "/audit" },
] as const

/**
 * Mobile-only bottom bar (< md). Four fixed slots + a "More" trigger that
 * springs up a grouped sheet rendering THE SAME registry as the desktop
 * sidebar — one source of truth, two surfaces tuned independently.
 */
export function BottomNav({ org, repo }: BottomNavProps) {
  const pathname = usePathname()
  const base = `/${org}/${repo}`
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive =
    !FIXED.some((f) => pathname === `${base}${f.suffix}`) &&
    [...NAV_GROUPS.flatMap((g) => g.items), ...GLOBAL_ITEMS].some((it) =>
      pathname === `${base}${it.suffix}` || pathname === it.suffix
    )

  return (
    <>
      <nav
        aria-label="Primary"
        className="glass-overlay select-none md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-16 grid-cols-4">
          {FIXED.map(({ label, icon: Icon, suffix }) => {
            const href = `${base}${suffix}`
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-transform active:scale-95"
              >
                {isActive && (
                  <motion.span
                    layoutId="bottomnav-active-dot"
                    className="absolute top-1 h-1 w-6 rounded-full bg-primary shadow-[0_0_10px_2px] shadow-primary/50"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className={isActive ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className="relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:scale-95"
          >
            {moreActive && (
              <span className="absolute top-1 h-1 w-6 rounded-full bg-primary shadow-[0_0_10px_2px] shadow-primary/50" />
            )}
            <MoreHorizontal className={cn("h-5 w-5", moreActive ? "text-primary" : "text-muted-foreground")} />
            <span className={moreActive ? "text-foreground" : "text-muted-foreground"}>More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-background/95 backdrop-blur-xl md:hidden"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
            >
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-700" />
              {NAV_GROUPS.map((g) => (
                <section key={g.id} className="px-4 pt-4">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                    {g.label}
                  </p>
                  <ul className="space-y-1">
                    {g.items.map(({ label, suffix, icon: Icon, description }) => {
                      const href = `${base}${suffix}`
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={() => setMoreOpen(false)}
                            className="flex items-center gap-3 rounded-xl border border-transparent bg-card/40 p-3 transition-colors hover:border-primary/30 hover:bg-accent/60"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{label}</span>
                              {description && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {description}
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              <section className="px-4 pb-2 pt-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                  Global
                </p>
                <ul className="space-y-1">
                  {GLOBAL_ITEMS.map(({ label, suffix, icon: Icon, description }) => (
                    <li key={suffix}>
                      <Link
                        href={suffix}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-3 rounded-xl border border-transparent bg-card/40 p-3 transition-colors hover:border-primary/30 hover:bg-accent/60"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{label}</span>
                          {description && (
                            <span className="block truncate text-xs text-muted-foreground">{description}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}