// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface UseClipboardReturn {
  /** True for `resetDelayMs` after the last successful copy. */
  copied: boolean
  /** Non-null only if the last copy attempt threw. */
  error: Error | null
  copy: (text: string) => Promise<void>
}

/**
 * Copy-to-clipboard hook with a success/error state. Uses the async
 * Clipboard API when available, with a hidden-textarea + execCommand
 * fallback for non-secure contexts. `copied` flips to true after a
 * successful copy and resets after `resetDelayMs`.
 */
export function useClipboard(resetDelayMs = 2000): UseClipboardReturn {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any pending reset timer on unmount so it can't setState after
  // the component is gone.
  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          // Fallback for non-secure origins / older browsers where the
          // Clipboard API is undefined.
          const el = document.createElement("textarea")
          el.value = text
          el.setAttribute("readonly", "")
          el.style.position = "absolute"
          el.style.left = "-9999px"
          document.body.appendChild(el)
          el.select()
          document.execCommand("copy")
          document.body.removeChild(el)
        }
        setError(null)
        setCopied(true)
        if (resetTimer.current) clearTimeout(resetTimer.current)
        resetTimer.current = setTimeout(() => setCopied(false), resetDelayMs)
      } catch (err) {
        setCopied(false)
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    },
    [resetDelayMs]
  )

  return { copied, error, copy }
}
