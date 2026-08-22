// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AuditGraphPane, type AuditFocusTarget } from "@/components/script/AuditGraphPane"

interface SecurityFindingItem {
  id?: string
  ruleId?: string
  title?: string
  description?: string
  severity: string
  location?: { filePath: string; line?: number }
  cwe?: string[]
}

interface DoctorFindingItem {
  checkId: string
  severity: "error" | "warning" | "info"
  message: string
  filePath?: string
}

type AuditItem = SecurityFindingItem & DoctorFindingItem & {
  source: "doctor" | "security"
}

interface AuditChapter {
  id: string
  label: string
  kind: "security" | "doctor"
  count: number
  items: AuditItem[]
}

interface AuditCategory {
  id: string
  label: string
  score: number
  findingCount: number
}

interface AuditResponse {
  repoUrl: string
  moduleCount: number
  findingTotal: number
  overallHealth: number
  categories: AuditCategory[]
  attackSurface: { entryPoints: number; reachableModules: number; unreachableModules: number }
  chapters: AuditChapter[]
}

const BOOT_LINES = [
  "ARCLUX ▸ inisialisasi pemindaian struktural…",
  "ARCLUX ▸ 27 parser siap · 20 detektor dimuat",
  "ARCLUX ▸ mengkloning & mengindeks repositori…",
  "ARCLUX ▸ memetakan permukaan serangan…",
]

function severityDot(sev: string): string {
  if (sev === "critical" || sev === "error") return "bg-red-500"
  if (sev === "high") return "bg-orange-500"
  if (sev === "warning" || sev === "medium") return "bg-yellow-500"
  return "bg-neutral-500"
}

function FindingRow({ item }: { item: AuditItem }) {
  const title =
    (item.source === "security" ? item.title : undefined) ??
    (item.checkId ? `${item.checkId}` : "finding")
  const detail =
    item.source === "security"
      ? item.description ?? ""
      : item.message
  const loc = item.location?.filePath ?? item.filePath
  const line = item.location?.line

  return (
    <li className="rounded border border-neutral-800/80 bg-neutral-950/70 px-2.5 py-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${severityDot(item.severity)}`} aria-hidden />
        {item.source === "security" && item.ruleId && (
          <code className="text-[11px] text-neutral-400">{item.ruleId}</code>
        )}
        {item.source === "doctor" && (
          <code className="text-[11px] text-neutral-400">{item.checkId}</code>
        )}
        <span className="text-[10px] uppercase tracking-wide text-neutral-600">{item.severity}</span>
        {loc && (
          <code className="truncate font-mono text-[11px] text-neutral-500">
            {loc}
            {line !== undefined && `:${line}`}
          </code>
        )}
      </div>
      {detail && <p className="mt-0.5 pl-3.5 text-xs text-neutral-300">{detail}</p>}
      {item.cwe && item.cwe.length > 0 && (
        <p className="pl-3.5 font-mono text-[10px] text-neutral-700">{item.cwe.join(" · ")}</p>
      )}
      {/* keep title referenced for security rows */}
      {item.source === "security" && item.title && item.title !== detail ? null : null}
      <span className="hidden">{title}</span>
    </li>
  )
}

/**
 * Audit mode inside the script playground terminal: press run → boot
 * sequence plays while /api/audit composes doctor + security + attack
 * surface → real numbers land → chapters reveal staggered. Deterministic
 * theater over existing engine output — no AI, no fake findings.
 */
export function AuditPanel() {
  const [repoInput, setRepoInput] = useState("https://github.com/left-pad/left-pad")
  const [phase, setPhase] = useState<"idle" | "booting" | "done">("idle")
  const [bootVisible, setBootVisible] = useState(0)
  const [revealedChapters, setRevealedChapters] = useState(0)
  const [data, setData] = useState<AuditResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  /** Flat cursor over all chapter items; -1 = nothing focused yet. */
  const [cursor, setCursor] = useState(-1)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [bootVisible, revealedChapters, phase])

  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  async function startAudit() {
    if (phase === "booting") return
    const repoUrl = repoInput.trim()
    if (!repoUrl) return

    clearTimers()
    setPhase("booting")
    setBootVisible(0)
    setRevealedChapters(0)
    setCursor(-1)
    setData(null)
    setError(null)
    setElapsedMs(null)

    // Staged boot lines (~650ms apart) while the single fetch runs.
    BOOT_LINES.forEach((_, i) => {
      timersRef.current.push(setTimeout(() => setBootVisible(i + 1), i * 650))
    })

    const started = performance.now()
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Audit failed")
        setPhase("done")
        clearTimers()
        setBootVisible(BOOT_LINES.length)
        return
      }
      const elapsed = Math.round(performance.now() - started)
      const result = body as AuditResponse

      // Land the summary exactly when the data is real.
      clearTimers()
      setBootVisible(BOOT_LINES.length)
      timersRef.current.push(
        setTimeout(() => {
          setData(result)
          setElapsedMs(elapsed)
          setPhase("done")
          // Staggered chapter reveal after the summary line.
          result.chapters.forEach((_, i) => {
            timersRef.current.push(setTimeout(() => setRevealedChapters(i + 1), 350 * (i + 1)))
          })
        }, 450)
      )
    } catch (err) {
      clearTimers()
      setBootVisible(BOOT_LINES.length)
      setError(err instanceof Error ? err.message : "Request failed")
      setPhase("done")
    }
  }

  function skip() {
    if (phase !== "booting") return
    clearTimers()
    setBootVisible(BOOT_LINES.length)
  }

  const shownSummaryLine =
    data &&
    `✓ ${data.moduleCount} modul · ${data.findingTotal} temuan · health ${data.overallHealth} · surface ${data.attackSurface.entryPoints} entry/${data.attackSurface.reachableModules} reachable` +
      (elapsedMs !== null ? ` · ${ (elapsedMs / 1000).toFixed(1) }s` : "")

  const flatItems = useMemo(() => {
    if (!data) return []
    return data.chapters.flatMap((ch, ci) =>
      ch.items.map((it, ii) => ({ chapterIndex: ci, item: it as AuditItem, itemIndex: ii }))
    )
  }, [data])

  const activeItem = cursor >= 0 && cursor < flatItems.length ? flatItems[cursor] : null

  const focusTarget: AuditFocusTarget | null = useMemo(() => {
    if (!activeItem) return null
    const it = activeItem.item
    const filePath =
      it.location?.filePath ?? it.filePath ?? null
    const cycleFiles =
      it.checkId === "circularDependency" && it.message.includes("\u2192")
        ? it.message.split("\u2192").map((p) => p.trim()).filter(Boolean)
        : []
    return { filePath, cycleFiles }
  }, [activeItem])

  const goNext = useCallback(() => {
    setCursor((c) => Math.min(c + 1, flatItems.length - 1))
  }, [flatItems.length])
  const goPrev = useCallback(() => {
    setCursor((c) => Math.max(c - 1, 0))
  }, [])

  // Keyboard arrows drive the walkthrough while results are on screen.
  useEffect(() => {
    if (phase !== "done" || !data || flatItems.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return
      if (e.key === "ArrowRight") goNext()
      else if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase, data, flatItems.length, goNext, goPrev])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* audit input row */}
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="font-mono text-xs text-violet-400">audit ▸</span>
        <input
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void startAudit()}
          placeholder="https://github.com/org/repo"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-neutral-200 outline-none placeholder:text-neutral-700"
        />
        <button
          onClick={() => void startAudit()}
          disabled={phase === "booting"}
          className="rounded border border-neutral-700 px-2.5 py-0.5 font-mono text-[11px] text-neutral-300 hover:border-red-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "booting" ? "scanning…" : "▶ audit"}
        </button>
      </div>

      {/* theater + chapters (left) | 3D fly-cam (right, large screens) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {phase === "idle" && (
          <p className="text-neutral-600">
            Tekan <span className="text-red-400">▶ audit</span> — ARCLUX akan menjalankan detektor,
            keamanan, dan attack surface secara berurutan di atas data nyata.
          </p>
        )}

        {(phase !== "idle") &&
          BOOT_LINES.slice(0, bootVisible).map((line, i) => (
            <div key={i} className={i === BOOT_LINES.length - 1 ? "text-cyan-400/80" : "text-neutral-400"}>
              {line.startsWith("✓") || line.includes("▸ mengindeks") ? line : line}
              {i < bootVisible - 1 || phase === "done" ? "" : ""}
            </div>
          ))}

        {phase === "booting" && (
          <button
            onClick={skip}
            className="ml-auto block rounded border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-300"
          >
            skip intro ⏭
          </button>
        )}

        {phase === "done" && error && (
          <div className="rounded border border-red-900/60 bg-red-950/30 px-2.5 py-1.5">
            <span className="font-semibold text-red-400">✗ </span>
            <span className="text-red-300/90">{error}</span>
          </div>
        )}

        {phase === "done" && data && (
          <>
            <div className="text-emerald-400">{shownSummaryLine}</div>

            {/* health bars */}
            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
              {data.categories.map((c) => (
                <div key={c.id} className="rounded border border-neutral-800/80 bg-neutral-950/70 p-2">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[10px] uppercase tracking-wide text-neutral-500">
                      {c.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-neutral-200">{c.score}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${
                        c.score >= 90 ? "bg-emerald-500" : c.score >= 70 ? "bg-yellow-500" : c.score >= 40 ? "bg-orange-500" : "bg-red-500"
                      }`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* chapters */}
            {data.chapters.map((chapter, ci) =>
              ci < revealedChapters ? (
                <section key={chapter.id} className="pt-1">
                  <h3 className="mb-1.5 flex items-baseline gap-2">
                    <span className="text-neutral-600">──</span>
                    <span
                      className={
                        chapter.kind === "security"
                          ? "font-semibold tracking-wide text-red-400"
                          : "font-semibold tracking-wide text-yellow-400"
                      }
                    >
                      BAB {ci + 1} ▸ {chapter.label.toUpperCase()}
                    </span>
                    <span className="text-neutral-600">({chapter.count})</span>
                    <span className="flex-1 border-t border-dashed border-neutral-800" />
                  </h3>
                  <ul className="space-y-1.5 pl-2">
                    {chapter.items.map((item, i) => (
                      <FindingRow key={`${chapter.id}-${i}`} item={item} />
                    ))}
                  </ul>
                </section>
              ) : null
            )}

            {data.chapters.length === 0 && revealedChapters > 0 && (
              <div className="text-emerald-400">✓ Bersih — tidak ada temuan di semua kategori.</div>
            )}
          </>
        )}
      </div>

        {/* walkthrough navigator + 3D pane (lg+) */}
        {phase === "done" && data && flatItems.length > 0 && (
          <div className="hidden w-[42%] shrink-0 flex-col border-l border-neutral-800 lg:flex">
            <AuditGraphPane repoUrl={repoInput.trim()} target={focusTarget} />
            <div className="flex shrink-0 items-center gap-2 border-t border-neutral-800 px-3 py-2">
              <button
                onClick={goPrev}
                disabled={cursor <= 0}
                className="rounded border border-neutral-700 px-2 py-0.5 font-mono text-[11px] text-neutral-300 hover:border-blue-500 disabled:opacity-30"
              >
                ‹ prev
              </button>
              <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                {cursor + 1} / {flatItems.length}
              </span>
              <button
                onClick={goNext}
                disabled={cursor >= flatItems.length - 1}
                className="rounded border border-neutral-700 px-2 py-0.5 font-mono text-[11px] text-neutral-300 hover:border-blue-500 disabled:opacity-30"
              >
                next ›
              </button>
              <span className="ml-auto hidden font-mono text-[10px] text-neutral-600 xl:inline">
                ←/→ navigate
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}