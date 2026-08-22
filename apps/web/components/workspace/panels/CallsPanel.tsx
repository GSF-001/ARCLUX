// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useEffect, useState } from "react"
import { postJson } from "@/lib/api"
import { LoadingState } from "@/components/patterns/LoadingState"
import { ErrorState } from "@/components/patterns/ErrorState"
import { EmptyState } from "@/components/patterns/EmptyState"

interface CallEdge {
  callee: string
  calleeLabel: string
  caller: string
  callerLabel: string
  weight: number
}

interface FocusedResponse {
  moduleId: string
  filePath: string | null
  outgoing: CallEdge[]
  incoming: CallEdge[]
  edgeTotal: number
}

interface OverviewResponse {
  nodeCount: number
  edgeTotal: number
  topModules: { moduleId: string; filePath: string | null; label: string; callWeight: number }[]
}

type CallgraphResponse = FocusedResponse | OverviewResponse

function isFocused(r: CallgraphResponse): r is FocusedResponse {
  return "moduleId" in r
}

function EdgeRow({ label, weight }: { label: string; weight: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <code className="truncate font-mono text-xs text-neutral-300">{label}</code>
      <span className="shrink-0 rounded-full bg-neutral-800/80 px-2 py-0.5 font-mono text-[10px] tabular-nums text-neutral-400">
        ×{weight}
      </span>
    </li>
  )
}

/**
 * Workspace Calls tab: list view over buildCallGraph — which file calls
 * which, resolved through named imports. Focuses on the selected module
 * (callers + callees) or falls back to the busiest modules overall.
 * Deliberately list-shaped: the interactive canvas is untouched.
 */
export function CallsPanel({ repoUrl, branch, moduleId }: CallsPanelProps) {
  const [data, setData] = useState<CallgraphResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await postJson<CallgraphResponse>("/api/callgraph", {
          repoUrl,
          branch,
          moduleId: moduleId ?? undefined,
        })
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to build call graph")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [repoUrl, branch, moduleId, retryCount])

  if (isLoading) return <LoadingState label="Tracing call relationships..." />
  if (error || !data) {
    return (
      <ErrorState
        title="Could not build call graph"
        message={error ?? "No data returned from /api/callgraph."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    )
  }

  if (!isFocused(data)) {
    return (
      <div className="flex h-full flex-col overflow-auto">
        <div className="border-b border-neutral-800 px-4 py-2.5 text-xs text-neutral-500">
          Busiest modules by call weight · {data.nodeCount} modules, {data.edgeTotal} call edges
        </div>
        {data.topModules.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No resolved calls"
              message="No cross-file calls were resolved for this repository (only the JS family extracts calls today)."
            />
          </div>
        ) : (
          <ul className="flex-1 space-y-2 p-4">
            {data.topModules.map((m) => (
              <EdgeRow key={m.moduleId} label={m.filePath ?? m.label} weight={m.callWeight} />
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b border-neutral-800 px-4 py-2.5">
        <code className="text-xs text-neutral-300">{data.filePath ?? data.moduleId}</code>
      </div>
      <div className="grid flex-1 gap-4 p-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Calls ({data.outgoing.length})
          </h3>
          {data.outgoing.length === 0 ? (
            <p className="text-xs text-neutral-500">This file makes no resolved cross-file calls.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.outgoing.map((e) => (
                <EdgeRow key={`out-${e.callee}`} label={e.calleeLabel} weight={e.weight} />
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Called by ({data.incoming.length})
          </h3>
          {data.incoming.length === 0 ? (
            <p className="text-xs text-neutral-500">Nothing calls this file.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.incoming.map((e) => (
                <EdgeRow key={`in-${e.caller}`} label={e.callerLabel} weight={e.weight} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

interface CallsPanelProps {
  repoUrl: string
  branch?: string
  /** Selected module id from FilesPanel/WorkspaceSearch; null = overview */
  moduleId?: string | null
}