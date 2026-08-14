// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useEffect, useState } from "react"
import { SearchInput } from "@/components/patterns/SearchInput"

interface SearchResult {
  filePath: string
  moduleId: string
  score: number
}

interface SearchResponse {
  results: SearchResult[]
}

export interface WorkspaceSearchProps {
  repoUrl: string
  branch?: string
  onSelect?: (moduleId: string) => void
}

/**
 * Inline search box for the workspace header, backed by GET /api/search
 * (fuzzyScore.ts on file paths only -- see that route's own comment for
 * why this is a stopgap, not real search). Debounced by 200ms to avoid
 * hammering the endpoint on every keystroke, since /api/search currently
 * re-clones and re-indexes the whole repo per call (no caching yet,
 * packages/cache/* is still unimplemented -- same caveat noted on
 * /api/impact).
 */
export function WorkspaceSearch({ repoUrl, branch, onSelect }: WorkspaceSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)

  // Reset results when the query becomes empty. Done during render (not in
  // an effect) per React's "adjusting state when a prop changes" guidance,
  // avoiding react-hooks/set-state-in-effect.
  const [prevQuery, setPrevQuery] = useState(query)
  if (prevQuery !== query) {
    setPrevQuery(query)
    if (!query.trim()) {
      setResults([])
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!query.trim()) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ repoUrl, q: query })
        if (branch) params.set("branch", branch)
        const res = await fetch(`/api/search?${params.toString()}`)
        if (!res.ok) return
        const json: SearchResponse = await res.json()
        if (!cancelled) {
          setResults(json.results ?? [])
          setIsOpen(true)
        }
      } catch {
        // Silently drop failed search requests -- this is a lightweight
        // inline search, not worth showing an ErrorState for.
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, repoUrl, branch])

  return (
    <div className="relative w-64">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search files..."
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow-lg">
          {results.slice(0, 8).map((r) => (
            <button
              key={r.moduleId}
              type="button"
              onClick={() => {
                onSelect?.(r.moduleId)
                setQuery("")
                setIsOpen(false)
              }}
              className="block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {r.filePath}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
