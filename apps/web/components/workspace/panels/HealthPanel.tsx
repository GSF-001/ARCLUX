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

interface HealthCategory {
  id: string
  label: string
  score: number
  findingCount: number
}

interface HealthResponse {
  repoUrl: string
  overall: number
  categories: HealthCategory[]
  moduleCount: number
  findingTotal: number
}

function scoreTone(score: number): { bar: string; text: string; ring: string } {
  if (score >= 90) return { bar: "bg-emerald-500", text: "text-emerald-500", ring: "stroke-emerald-500" }
  if (score >= 70) return { bar: "bg-yellow-500", text: "text-yellow-500", ring: "stroke-yellow-500" }
  if (score >= 40) return { bar: "bg-orange-500", text: "text-orange-500", ring: "stroke-orange-500" }
  return { bar: "bg-red-500", text: "text-red-500", ring: "stroke-red-500" }
}

/** Circular gauge for the overall score (SVG, no chart lib). */
function OverallGauge({ score }: { score: number }) {
  const tone = scoreTone(score)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" className="stroke-neutral-800" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className={tone.ring}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-semibold tabular-nums ${tone.text}`}>{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-neutral-500">health</span>
      </div>
    </div>
  )
}

/**
 * Workspace Health tab: POST /api/health aggregated over the doctor suite.
 * Overall gauge + per-category bars, normalized by module count so large
 * repos aren't punished for size. Formula in packages/engine/healthScore.ts.
 */
export function HealthPanel({ repoUrl, branch }: HealthPanelProps) {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await postJson<HealthResponse>("/api/health", { repoUrl, branch })
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to compute health score")
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

  if (isLoading) return <LoadingState label="Scoring repository health..." />
  if (error || !data) {
    return (
      <ErrorState
        title="Could not compute health"
        message={error ?? "No data returned from /api/health."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="flex items-center gap-6 rounded-lg border border-neutral-800 bg-neutral-950/60 p-5">
        <OverallGauge score={data.overall} />
        <div className="min-w-0">
          <p className="text-sm font-medium">Architecture health</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            {data.findingTotal} finding{data.findingTotal === 1 ? "" : "s"} across{" "}
            {data.moduleCount} modules, aggregated into four categories.
            Severity-weighted and normalized by module count — details in{" "}
            <code className="text-[10px] text-neutral-500">packages/engine/healthScore.ts</code>.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {data.categories.map((cat) => {
          const tone = scoreTone(cat.score)
          return (
            <li key={cat.id} className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-3">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm">{cat.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>{cat.score}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full rounded-full ${tone.bar} transition-all duration-500`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                {cat.findingCount === 0
                  ? "clean"
                  : `${cat.findingCount} finding${cat.findingCount === 1 ? "" : "s"} affecting this category`}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface HealthPanelProps {
  repoUrl: string
  branch?: string
}