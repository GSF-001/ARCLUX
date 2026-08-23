// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/cn"

/**
 * Renders a spinner only while THIS link's navigation is pending.
 * Must be rendered inside a <Link> subtree — useLinkStatus reads the
 * enclosing link's status (Next 15.3+).
 */
export function PendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <Loader2
      className={cn("h-4 w-4 shrink-0 animate-spin text-primary", className)}
      aria-hidden
    />
  )
}

/**
 * Link with built-in pending affordance: while its route loads, the icon
 * slot cross-fades to a spinner and the whole row dims — so a slow
 * transition never reads as "nothing happened / bug".
 *
 * Children receive nothing special; pass icon+label yourself and drop
 * <PendingSpinner/> wherever the spinner should appear.
 */
export const NavLink = Link

/** Icon slot that swaps to a spinner while the enclosing link pends. */
export function PendingSwap({
  icon: Icon,
  className,
  spinClassName,
}: {
  icon: React.ComponentType<{ className?: string }>
  className?: string
  spinClassName?: string
}) {
  const { pending } = useLinkStatus()
  if (pending) {
    return (
      <Loader2
        aria-hidden
        className={cn("shrink-0 animate-spin text-primary", spinClassName ?? className)}
      />
    )
  }
  return <Icon aria-hidden className={className} />
}
