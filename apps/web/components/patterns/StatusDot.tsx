// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { cn } from "@/lib/cn"

export type StatusDotVariant = "success" | "warning" | "error" | "info" | "neutral"

interface StatusDotProps {
  variant?: StatusDotVariant
  label?: string
  className?: string
}

const variantClasses: Record<StatusDotVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
  info: "bg-blue-500",
  neutral: "bg-muted-foreground",
}

export function StatusDot({ variant = "neutral", label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", variantClasses[variant])} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  )
}
