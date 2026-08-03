// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"

export interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  options: FilterOption[]
  active: string[]
  onToggle: (value: string) => void
  className?: string
}

export function FilterBar({ options, active, onToggle, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {options.map((option) => {
        const isActive = active.includes(option.value)
        return (
          <Button
            key={option.value}
            variant={isActive ? "secondary" : "outline"}
            size="sm"
            onClick={() => onToggle(option.value)}
            aria-pressed={isActive}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
