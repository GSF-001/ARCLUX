// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useEffect, useState } from "react"

/**
 * Returns `value`, delayed by `delayMs` after it stops changing. Standard
 * debounce-a-value hook -- used by GlobalSearch.tsx to avoid firing
 * /api/search on every keystroke. WorkspaceSearch.tsx (components/
 * workspace/) implements the same debounce pattern inline via
 * setTimeout/clearTimeout rather than this hook -- that's pre-existing,
 * not something this hook replaces retroactively. If touching
 * WorkspaceSearch.tsx again, consider migrating it to use this hook
 * instead, to avoid two debounce implementations in the codebase.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
