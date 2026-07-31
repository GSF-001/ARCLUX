// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useCallback, useRef, useState } from "react"
import { cn } from "@/lib/cn"

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  className?: string
}

export function SplitPane({
  left,
  right,
  defaultLeftWidth = 320,
  minLeftWidth = 220,
  maxLeftWidth = 560,
  className,
}: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handlePointerDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const next = Math.min(Math.max(e.clientX - rect.left, minLeftWidth), maxLeftWidth)
      setLeftWidth(next)
    },
    [minLeftWidth, maxLeftWidth]
  )

  const stopDragging = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerLeave={stopDragging}
      className={cn("flex h-full w-full overflow-hidden", className)}
    >
      <div style={{ width: leftWidth }} className="h-full shrink-0 overflow-auto">
        {left}
      </div>

      <div
        onPointerDown={handlePointerDown}
        className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50"
        role="separator"
        aria-orientation="vertical"
      />

      <div className="h-full min-w-0 flex-1 overflow-auto">{right}</div>
    </div>
  )
}
