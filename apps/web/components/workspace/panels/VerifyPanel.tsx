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

interface RuleViolation {
  ruleId: string
  filePath: string
  message: string
  severity: string
}

interface CheckFindings {
  [checkId: string]: { checkId?: string; filePath?: string; message: string }[]
}

interface VerifyResponse {
  repoUrl: string
  frameworksChecked: string[]
  detectorTotal: number
  checks: CheckFindings
  rules: {
    violations: RuleViolation[]
    errors: number
    warnings: number
  }
  verdict: "PASS" | "FAIL"
}

/**
 * Workspace Verify tab: the CI gate as a panel — POST /api/verify returns
 * a single PASS/FAIL verdict over 10 detectors + all implemented framework
 * rules (framework filtering happens server-side via detectedFrameworks).
 */
export function VerifyPanel({ repoUrl, branch }: VerifyPanelProps) {
  const [data, setData] = useState<VerifyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await postJson<VerifyResponse>("/api/verify", { repoUrl, branch })
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to run verify")
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

  if (isLoading) return <LoadingState label="Running verify gate..." />
  if (error || !data) {
    return (
      <ErrorState
        title="Could not run verify"
        message={error ?? "No data returned from /api/verify."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    )
  }

  const pass = data.verdict === "PASS"
  const nonEmptyChecks = Object.entries(data.checks).filter(([, findings]) => findings.length > 0)

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex items-center gap-3 border-b px-4 py-3 ${
          pass ? "border-green-900 bg-green-950/40" : "border-red-900 bg-red-950/40"
        }`}
      >
        <span
          className={`rounded px-2 py-0.5 text-sm font-bold tracking-wide ${
            pass ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200"
          }`}
        >
          {data.verdict}
        </span>
        <span className="text-xs text-neutral-400">
          {data.detectorTotal} detector issue{data.detectorTotal === 1 ? "" : "s"} ·{" "}
          {data.rules.errors} rule error{data.rules.errors === 1 ? "" : "s"} ·{" "}
          {data.rules.warnings} warning{data.rules.warnings === 1 ? "" : "s"}
        </span>
        {data.frameworksChecked.length > 0 && (
          <span className="ml-auto text-xs text-neutral-500">
            frameworks: {data.frameworksChecked.join(", ")}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {nonEmptyChecks.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Detector findings
            </h3>
            <ul className="space-y-1.5">
              {nonEmptyChecks.map(([checkId, findings]) => (
                <li
                  key={checkId}
                  className="flex items-baseline gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-xs"
                >
                  <code className="text-neutral-400">{checkId}</code>
                  <span className="text-neutral-300">{findings.length} finding(s)</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.rules.violations.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Rule violations
            </h3>
            <ul className="space-y-1.5">
              {data.rules.violations.map((v, i) => (
                <li
                  key={`${v.ruleId}-${v.filePath}-${i}`}
                  className="rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <code className="text-xs text-neutral-400">{v.ruleId}</code>
                    <span
                      className={`text-[10px] uppercase tracking-wide ${
                        v.severity === "error" ? "text-red-400" : "text-yellow-500"
                      }`}
                    >
                      {v.severity}
                    </span>
                    <code className="truncate font-mono text-xs text-neutral-300">
                      {v.filePath}
                    </code>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-400">{v.message}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pass && nonEmptyChecks.length === 0 && data.rules.violations.length === 0 && (
          <p className="text-sm text-neutral-400">
            Clean — every detector and framework rule passed.
          </p>
        )}
      </div>
    </div>
  )
}

interface VerifyPanelProps {
  repoUrl: string
  branch?: string
}