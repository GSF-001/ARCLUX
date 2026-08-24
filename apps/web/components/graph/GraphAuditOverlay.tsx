// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { RadioTower, X } from "lucide-react"
import { useGraphContext } from "./GraphProvider"
import { useGraphAuditOverlay, type AuditSeverity } from "@/hooks/useGraphAuditOverlay"
import type { ForceGraphMethods } from "react-force-graph-3d"

interface GraphAuditOverlayProps {
  repoUrl: string
  branch?: string
  fgRef: React.MutableRefObject<ForceGraphMethods | undefined>
  /** Current dimension — halos only exist in 3D, so clicking from 2D
   *  switches the canvas first (user never has to hunt the toggle). */
  is3D: boolean
  onEnable3D: () => void
}

interface AuditChapterItem {
  source: "doctor" | "security"
  severity: string
  location?: { filePath: string; line?: number }
  filePath?: string
}

interface AuditResponseShape {
  moduleCount: number
  findingTotal: number
  overallHealth: number
  chapters: { id: string; label: string; count: number; items: AuditChapterItem[] }[]
}

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-950/80 text-red-300 border-red-800/60",
  error: "bg-red-950/80 text-red-300 border-red-800/60",
  high: "bg-orange-950/80 text-orange-300 border-orange-800/60",
  warning: "bg-orange-950/80 text-orange-300 border-orange-800/60",
  medium: "bg-yellow-950/80 text-yellow-300 border-yellow-800/60",
  low: "bg-neutral-900/80 text-neutral-400 border-neutral-700/60",
  info: "bg-neutral-900/80 text-neutral-400 border-neutral-700/60",
}

/**
 * Floating "audit" chip over the 3D canvas (only visible in 3D mode — the
 * overlay hook drives the live scene through fgRef, which exists only
 * there). Runs POST /api/audit, then REPLAYS the findings onto the graph
 * one by one so nodes light up with severity halos while the scan plays
 * out — the graph itself becomes the audit theater.
 *
 * Core files untouched: this is pure composition around GraphViewport's
 * existing fgRef + /api/audit output.
 */
export function GraphAuditOverlay({ repoUrl, branch, fgRef, is3D, onEnable3D }: GraphAuditOverlayProps) {
  const { graph } = useGraphContext()
  const [mode, setMode] = useState<"idle" | "scanning" | "done">("idle")
  const [summary, setSummary] = useState<AuditResponseShape | null>(null)
  const [error, setError] = useState<string | null>(null)

  // filePath → id from the provider graph (full node data — the scene's
  // node objects don't carry filePath, see hook docs).
  const filePathToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of graph?.nodes ?? []) {
      if (n.filePath) map.set(n.filePath, n.id)
    }
    return map
  }, [graph])

  const overlay = useGraphAuditOverlay(fgRef, filePathToId)

  const graphReady = graph !== null

  async function runAudit() {
    if (!graphReady || mode === "scanning") return
    if (!is3D) {
      onEnable3D()
      // Give the 3D canvas a beat to mount before halos start landing.
      await new Promise((r) => setTimeout(r, 350))
    }
    setMode("scanning")
    setError(null)
    setSummary(null)
    overlay.start()

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, branch: branch ?? undefined }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Audit failed")
        setMode("done")
        overlay.stop()
        return
      }

      const data = body as AuditResponseShape
      setSummary(data)

      // Replay findings onto the graph one at a time — the reveal IS the
      // show. ~60ms apart feels like a live scan without dragging on.
      const flat = data.chapters.flatMap((ch) => ch.items)
      const all: { filePath: string; severity: AuditSeverity }[] = []
      for (const item of flat) {
        const filePath = item.location?.filePath ?? item.filePath
        if (!filePath) continue
        const sev = item.severity as AuditSeverity
        all.push({ filePath, severity: sev })
        // Cap the replay stream at 150 for huge repos — everything after
        // flags in one final burst so the picture stays complete.
      }
      const STREAM_CAP = 150
      const delay = all.length > STREAM_CAP ? 25 : 60

      for (let i = 0; i < all.length; i++) {
        overlay.flag(all[i])
        if (i < STREAM_CAP) {
          await new Promise((r) => setTimeout(r, delay))
        }
      }

      setMode("done")
      // Keep halos breathing after the scan — the graph remembers its
      // wounds until the user closes the chip.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
      setMode("done")
      overlay.stop()
    }
  }

  function closeChip() {
    overlay.clear()
    setMode("idle")
    setSummary(null)
    setError(null)
  }

  const flagged = overlay.findings.length

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
      <AnimatePresence>
        {mode === "idle" && graphReady && (
          <motion.button
            key="run"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => void runAudit()}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-800/70 bg-black/80 px-4 py-2 font-mono text-xs text-emerald-400 backdrop-blur transition-colors hover:border-emerald-500 hover:text-emerald-300"
          >
            <RadioTower className="h-3.5 w-3.5" />
            run audit on graph
          </motion.button>
        )}

        {mode === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-emerald-700/60 bg-black/85 px-4 py-2 font-mono text-xs backdrop-blur"
          >
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            <span className="text-emerald-300">scanning…</span>
            <span className="tabular-nums text-neutral-400">{flagged} flagged</span>
          </motion.div>
        )}

        {mode === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto max-w-xs rounded-xl border border-neutral-800 bg-black/90 p-3 font-mono text-xs backdrop-blur"
          >
            {error ? (
              <p className="text-red-400">✗ {error}</p>
            ) : summary ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓ audit complete</span>
                  <button
                    onClick={closeChip}
                    aria-label="Clear audit halos"
                    className="ml-auto rounded p-0.5 text-neutral-500 hover:text-neutral-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-neutral-400">
                  {summary.moduleCount} modules · {summary.findingTotal} findings · health{" "}
                  <span className="text-emerald-400">{summary.overallHealth}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(
                    overlay.findings.reduce<Record<string, number>>((acc, f) => {
                      acc[f.severity] = (acc[f.severity] ?? 0) + 1
                      return acc
                    }, {})
                  )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([sev, count]) => (
                      <span
                        key={sev}
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${SEV_BADGE[sev] ?? SEV_BADGE.info}`}
                      >
                        {sev} {count}
                      </span>
                    ))}
                </div>
                <p className="mt-1.5 text-[10px] text-neutral-600">
                  nodes breathing = findings · ✕ clears halos
                </p>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {!graphReady && mode !== "scanning" && (
        <span className="rounded-full bg-black/60 px-3 py-1.5 font-mono text-[10px] text-neutral-600">
          loading graph…
        </span>
      )}
    </div>
  )
}