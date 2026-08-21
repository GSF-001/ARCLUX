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

interface SecurityFinding {
  id: string
  ruleId: string
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low"
  confidence: string
  location: { filePath: string; line?: number }
  cwe?: string[]
}

interface SecurityResponse {
  repoUrl: string
  analyzedAt: string
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    entryPoints: number
    reachableModules: number
    unreachableModules: number
  }
  findings: SecurityFinding[]
}

const SEVERITY_DOT: Record<SecurityFinding["severity"], string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-neutral-500",
}

function FindingRow({ finding }: { finding: SecurityFinding }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[finding.severity]}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <code className="text-xs text-neutral-400">{finding.ruleId}</code>
          <span className="text-[10px] uppercase tracking-wide text-neutral-600">
            {finding.severity}
          </span>
          <code className="truncate font-mono text-xs text-neutral-300">
            {finding.location.filePath}
            {finding.location.line !== undefined && `:${finding.location.line}`}
          </code>
        </div>
        <p className="mt-0.5 text-xs text-neutral-400">{finding.title}</p>
        {finding.cwe && finding.cwe.length > 0 && (
          <p className="mt-0.5 font-mono text-[10px] text-neutral-600">
            {finding.cwe.join(" · ")}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Workspace Security tab: source-level security findings (secrets, unsafe
 * patterns, dangerous APIs) + attack-surface counts from POST /api/security.
 * Same loading/error/retry contract as IssuesPanel.
 */
export function SecurityPanel({ repoUrl, branch }: SecurityPanelProps) {
  const [data, setData] = useState<SecurityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await postJson<SecurityResponse>("/api/security", { repoUrl, branch })
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to run security analysis")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [repoUrl, branch, retryCount])

  if (isLoading) return <LoadingState label="Running security analysis..." />
  if (error || !data) {
    return (
      <ErrorState
        title="Could not run security analysis"
        message={error ?? "No data returned from /api/security."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    )
  }

  const { summary, findings } = data
  const order: SecurityFinding["severity"][] = ["critical", "high", "medium", "low"]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2.5 text-sm">
        <span className="font-medium">
          {summary.total} finding{summary.total === 1 ? "" : "s"}
        </span>
        {order.map((sev) =>
          summary[sev] > 0 ? (
            <span key={sev} className="flex items-center gap-1.5 text-xs text-neutral-400">
              <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[sev]}`} aria-hidden />
              {summary[sev]} {sev}
            </span>
          ) : null
        )}
        <span className="ml-auto text-xs text-neutral-500">
          attack surface: {summary.entryPoints} entry · {summary.reachableModules} reachable ·{" "}
          {summary.unreachableModules} unreachable
        </span>
      </div>
      {findings.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No security findings"
            message="Source-level checks (secrets, unsafe patterns, dangerous APIs) ran clean."
          />
        </div>
      ) : (
        <ul className="flex-1 space-y-2 overflow-auto p-4">
          {order.flatMap((sev) =>
            findings
              .filter((f) => f.severity === sev)
              .map((f) => <FindingRow key={f.id} finding={f} />)
          )}
        </ul>
      )}
    </div>
  )
}

interface SecurityPanelProps {
  repoUrl: string
  branch?: string
}