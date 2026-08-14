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
import { EmptyState } from "@/components/patterns/EmptyState"
import { useDebounce } from "@/hooks/useDebounce"

interface SearchResult {
  filePath: string
  moduleId: string
  score: number
}

interface SearchResponse {
  results: SearchResult[]
}

export interface GlobalSearchProps {
  repoUrl: string
  branch?: string
  onSelect?: (moduleId: string) => void
}

/**
 * Standalone search component hitting GET /api/search (fuzzyScore.ts
 * stopgap, file-path-only -- see that route's own comment for caveats:
 * no caching, re-indexes the whole repo per call).
 *
 * This intentionally overlaps with components/workspace/WorkspaceSearch.tsx
 * (same API, same debounce-then-fetch shape) -- that one is scoped
 * specifically to the workspace header and inlines its own debounce
 * logic. This one is the general-purpose version, meant for use outside
 * the workspace context (e.g. a global navbar search), and uses the
 * shared useDebounce hook instead of an inline setTimeout. Not merged
 * into one component because their trigger UI differs (WorkspaceSearch
 * always shows an inline dropdown; this one shows an EmptyState for the
 * zero-results case, which WorkspaceSearch does not need since it's a
 * compact header widget). If this divergence becomes a maintenance
 * burden, consider extracting a shared useRepoSearch(repoUrl, branch,
 * query) hook that both components call.
 *
 * IMPORTANT: earlier draft of this file (never committed) hardcoded
 * `items: SearchItem[] = []` with a "nanti ini bakal dari SearchProvider
 * / API" comment -- meaning search always silently returned zero results
 * while looking fully functional. That version is NOT what's implemented
 * here; this one actually calls the API.
 */
export function GlobalSearch({ repoUrl, branch, onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 200)
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  // Reset results when the query becomes empty. Done during render (not in
  // an effect) per React's "adjusting state when a prop changes" guidance,
  // avoiding react-hooks/set-state-in-effect.
  const [prevDebouncedQuery, setPrevDebouncedQuery] = useState(debouncedQuery)
  if (prevDebouncedQuery !== debouncedQuery) {
    setPrevDebouncedQuery(debouncedQuery)
    if (!debouncedQuery.trim()) {
      setResults([])
      setHasSearched(false)
    }
  }

  useEffect(() => {
    if (!debouncedQuery.trim()) return

    let cancelled = false
    async function run() {
      try {
        const params = new URLSearchParams({ repoUrl, q: debouncedQuery })
        if (branch) params.set("branch", branch)
        const res = await fetch(`/api/search?${params.toString()}`)
        if (!res.ok) return
        const json: SearchResponse = await res.json()
        if (!cancelled) {
          setResults(json.results ?? [])
          setHasSearched(true)
        }
      } catch {
        // Silently drop failed requests -- same tradeoff as
        // WorkspaceSearch.tsx, not worth an ErrorState for a lightweight
        // search box.
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, repoUrl, branch])

  return (
    <div className="w-full max-w-xl">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search files, modules..."
      />

      {hasSearched && results.length === 0 && (
        <div className="mt-2">
          <EmptyState title="No results" message={`Nothing matched "${debouncedQuery}".`} />
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-2 rounded-lg bg-card shadow-lg">
          {results.slice(0, 20).map((r) => (
            <button
              key={r.moduleId}
              type="button"
              onClick={() => onSelect?.(r.moduleId)}
              className="block w-full cursor-pointer px-3 py-2.5 text-left text-sm transition-transform hover:bg-muted active:scale-[0.99]"
            >
              <div className="font-medium">{r.filePath.split("/").pop()}</div>
              <div className="text-xs text-muted-foreground">{r.filePath}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
