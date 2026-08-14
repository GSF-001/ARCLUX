// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useCallback, useEffect, useState } from "react"

export interface UseCommandPaletteReturn {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export interface UseCommandPaletteOptions {
  /**
   * Keyboard shortcuts that toggle the palette, e.g. "mod+k" (meta on
   * macOS, ctrl elsewhere) or "/". Escape always closes. Defaults match
   * what CommandPalette.tsx hardcoded before this hook existed.
   */
  shortcutKeys?: string[]
}

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+")
  const key = parts[parts.length - 1]
  if (e.key.toLowerCase() !== key) return false

  const needsMod = parts.includes("mod")
  const needsCtrl = parts.includes("ctrl")
  const needsMeta = parts.includes("meta")
  const needsAlt = parts.includes("alt")
  const needsShift = parts.includes("shift")

  if (needsMod && !(e.metaKey || e.ctrlKey)) return false
  if (needsCtrl && !e.ctrlKey) return false
  if (needsMeta && !e.metaKey) return false
  if (needsAlt && !e.altKey) return false
  if (needsShift && !e.shiftKey) return false

  // A shortcut that requires no modifiers (e.g. plain "/") must not fire
  // while the user is holding modifiers for something else.
  const expectsNoModifier = !needsMod && !needsCtrl && !needsMeta && !needsAlt && !needsShift
  if (expectsNoModifier && (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)) return false

  return true
}

/**
 * Owns the open/closed state of a command palette plus the global keyboard
 * shortcuts that toggle it (Cmd/Ctrl+K and "/" by default; Escape closes).
 *
 * CommandPalette.tsx originally inlined this exact state + keydown wiring;
 * it now consumes this hook. The hook is exported separately so other
 * surfaces (e.g. a global trigger button or a second palette instance) can
 * share the same open-state without duplicating the shortcut logic.
 */
export function useCommandPalette(options: UseCommandPaletteOptions = {}): UseCommandPaletteReturn {
  const { shortcutKeys = ["mod+k", "/"] } = options
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      for (const shortcut of shortcutKeys) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault()
          setOpen((prev) => !prev)
          return
        }
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [shortcutKeys])

  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  return { open, setOpen, toggle }
}
