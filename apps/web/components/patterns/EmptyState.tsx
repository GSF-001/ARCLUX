// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { LucideIcon } from "lucide-react"
import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  message = "There's no data to show right now.",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
