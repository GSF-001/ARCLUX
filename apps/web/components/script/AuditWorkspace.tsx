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

// ── Data shapes (mirror /api/audit response verbatim) ──────────────────

/** Loose structural view of either finding family as /api/audit emits
 * them (route spreads originals + adds `source`). Kept flat on purpose —
 * an intersection of the two interfaces narrows `severity` wrongly. */
interface AuditItem {
  source: "doctor" | "security"
  severity: string
  id?: string
  ruleId?: string
  title?: string
  description?: string
  cwe?: string[]
  location?: { filePath: string; line?: number }
  checkId?: string
  message?: string
  filePath?: string
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

// ── Stream types ────────────────────────────────────────────────────────

type Tone = "dim" | "accent" | "ok" | "warn" | "bad"

interface StreamLine {
  text: string
  tone: Tone
}

const TONE_CLASS: Record<Tone, string> = {
  dim: "text-neutral-600",
  accent: "text-cyan-400",
  ok: "text-emerald-400",
  warn: "text-yellow-400",
  bad: "text-red-400",
}

function sevTone(sev: string): Tone {
  if (sev === "critical") return "bad"
  if (sev === "high" || sev === "error") return "warn"
  return "dim"
}

const BOOT_LINES: StreamLine[] = [
  { text: 'init.parsers[27]        → ok', tone: "accent" },
  { text: 'init.detectors[20]      → ok', tone: "accent" },
  { text: 'load.rules[14]          → ok', tone: "accent" },
  { text: 'clone(repo)             …', tone: "dim" },
]

/** Build the scan script from REAL audit output. Capped so a 2k-finding
 * repo streams fast instead of rendering forever — the FOCUS panel holds
 * every item, the stream is the show. */
function buildStreamScript(data: AuditResponse): StreamLine[] {
  const out: StreamLine[] = []
  const repoShort = data.repoUrl.replace(/^https?:\/\/github\.com\//, "")
  out.push({ text: `analyze("${repoShort}") → ${data.moduleCount} modules`, tone: "ok" })
  out.push({
    text: `surface.map() → ${data.attackSurface.entryPoints} entry · ${data.attackSurface.reachableModules} reachable`,
    tone: "accent",
  })

  const PER_CHAPTER_CAP = 24
  for (const ch of data.chapters) {
    out.push({ text: `── sweep "${ch.label.toLowerCase()}" · ${ch.count}`, tone: "dim" })
    for (const it of ch.items.slice(0, PER_CHAPTER_CAP)) {
      const file = it.location?.filePath ?? it.filePath ?? "?"
      const line = it.location?.line
      const rule = it.ruleId ?? it.checkId ?? "finding"
      out.push({
        text: `${rule}(${file}${line !== undefined ? `:${line}` : ""}) [${it.severity}]`,
        tone: sevTone(it.severity),
      })
    }
    if (ch.items.length > PER_CHAPTER_CAP) {
      out.push({ text: `… +${ch.items.length - PER_CHAPTER_CAP} more → FOCUS panel`, tone: "dim" })
    }
  }

  out.push({ text: `ARCLUX: ${data.findingTotal} anomali terdeteksi · health ${data.overallHealth}/100`, tone: "ok" })
  return out
}

// ── File preview overlay (unchanged behavior, raw.githubusercontent) ───

interface PreviewState {
  path: string
  line?: number
  content: string | null
  error?: string
}

function FilePreviewOverlay({
  target,
  repoUrl,
  branch,
  onClose,
}: {
  target: { path: string; line?: number }
  repoUrl: string
  branch?: string
  onClose: () => void
}) {
  const [preview, setPreview] = useState<PreviewState>({
    path: target.path,
    line: target.line,
    content: null,
  })
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ repoUrl, filePath: target.path })
    if (branch) params.set("branch", branch)
    fetch(`/api/file?${params}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        setPreview((p) => ({
          ...p,
          content: typeof body.content === "string" ? body.content : null,
          error: body.error,
        }))
      })
      .catch(() => {
        if (!cancelled) setPreview((p) => ({ ...p, error: "Failed to load file" }))
      })
    return () => {
      cancelled = true
    }
  }, [repoUrl, branch, target.path])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    if (preview.content === null || !target.line) return
    const el = preRef.current?.querySelector(`[data-line="${target.line}"]`)
    el?.scrollIntoView({ block: "center" })
  }, [preview.content, target.line])

  const lines = useMemo(() => (preview.content ?? "").split("\n"), [preview.content])

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[85%] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-emerald-900/50 bg-neutral-950">
        <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-500">file</span>
          <code className="truncate font-mono text-xs text-neutral-300">{target.path}</code>
          {target.line !== undefined && (
            <span className="font-mono text-[10px] text-red-400">:{target.line}</span>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded border border-neutral-700 px-2 py-0.5 font-mono text-[10px] text-neutral-400 hover:text-neutral-200"
          >
            esc ✕
          </button>
        </div>
        <pre ref={preRef} className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-relaxed">
          {preview.error ? (
            <div className="p-3 text-red-400">{preview.error}</div>
          ) : preview.content === null ? (
            <div className="p-3 text-neutral-500">memuat…</div>
          ) : (
            lines.map((ln, i) => (
              <div
                key={i}
                data-line={i + 1}
                className={
                  target.line === i + 1
                    ? "border-l-2 border-red-500 bg-red-950/60 px-2 text-red-200"
                    : "px-2 text-neutral-400 hover:bg-neutral-900"
                }
              >
                <span className="mr-3 inline-block w-8 select-none text-right text-neutral-700">
                  {i + 1}
                </span>
                {ln || " "}
              </div>
            ))
          )}
        </pre>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────

export interface AuditWorkspaceProps {
  initialRepoUrl?: string
  branch?: string
}

export function AuditWorkspace({ initialRepoUrl, branch }: AuditWorkspaceProps) {
  const [repoInput, setRepoInput] = useState(
    initialRepoUrl ?? "https://github.com/left-pad/left-pad"
  )
  const [phase, setPhase] = useState<"idle" | "booting" | "streaming" | "done">("idle")
  const [bootVisible, setBootVisible] = useState(0)
  const [streamLines, setStreamLines] = useState<StreamLine[]>([])
  const [streamProgress, setStreamProgress] = useState(0)
  const [data, setData] = useState<AuditResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(-1)
  const [openFile, setOpenFile] = useState<{ path: string; line?: number } | null>(null)

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  function clearTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => () => clearTimers(), [])

  // Auto-scroll the stream.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [streamLines, bootVisible])

  async function startAudit() {
    if (phase === "booting" || phase === "streaming") return
    const repoUrl = repoInput.trim()
    if (!repoUrl) return

    clearTimers()
    setPhase("booting")
    setBootVisible(0)
    setStreamLines([])
    setStreamProgress(0)
    setData(null)
    setError(null)
    setCursor(-1)

    BOOT_LINES.forEach((_, i) => {
      timersRef.current.push(setTimeout(() => setBootVisible(i + 1), i * 550))
    })

    const started = performance.now()
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, branch: branch ?? undefined }),
      })
      const body = await res.json()
      if (!res.ok) {
        clearTimers()
        setBootVisible(BOOT_LINES.length)
        setError(body.error ?? "Audit gagal")
        setPhase("done")
        return
      }

      clearTimers()
      const result = body as AuditResponse
      void started
      const script = buildStreamScript(result)

      // Summary lands as the first streamed line, then the rain begins.
      setPhase("streaming")
      let idx = 0
      setStreamLines([{ text: script[0].text, tone: "ok" }])
      idx = 1
      intervalRef.current = setInterval(() => {
        if (idx >= script.length) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          setData(result)
          setPhase("done")
          return
        }
        const line = script[idx]
        setStreamLines((prev) => [...prev.slice(-260), line])
        setStreamProgress(Math.round(((idx + 1) / script.length) * 100))
        idx++
      }, 55)
    } catch (err) {
      clearTimers()
      setBootVisible(BOOT_LINES.length)
      setError(err instanceof Error ? err.message : "Permintaan gagal")
      setPhase("done")
    }
  }

  function skip() {
    if (phase === "booting" || phase === "streaming") {
      clearTimers()
      // Fast-forward: show whatever we have; if data not yet in, wait flag
      // stays until fetch resolves (phase flips there).
      setBootVisible(BOOT_LINES.length)
      if (data) {
        setStreamLines(buildStreamScript(data))
        setStreamProgress(100)
        setPhase("done")
      } else if (phase === "streaming") {
        setPhase("done")
        setData((d) => d)
      }
    }
  }

  // ── walkthrough over flat findings ────────────────────────────────
  const flatItems = useMemo(() => {
    if (!data) return []
    return data.chapters.flatMap((ch) => ch.items.map((it) => ({ item: it as AuditItem })))
  }, [data])

  const active = cursor >= 0 && cursor < flatItems.length ? flatItems[cursor].item : null

  const focusTarget: AuditFocusTarget | null = useMemo(() => {
    if (!active) return null
    const filePath = active.location?.filePath ?? active.filePath ?? null
    const cycleFiles =
      active.checkId === "circularDependency" &&
      typeof active.message === "string" &&
      active.message.includes("→")
        ? active.message.split("→").map((p) => p.trim()).filter(Boolean)
        : []
    return { filePath, cycleFiles }
  }, [active])

  const goNext = useCallback(() => {
    setCursor((c) => Math.min(c + 1, flatItems.length - 1))
  }, [flatItems.length])
  const goPrev = useCallback(() => setCursor((c) => Math.max(c - 1, 0)), [])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return
      if (openFile) return
      if (e.key === "ArrowRight") goNext()
      else if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, openFile, goNext, goPrev])

  // ── derived counts for the status strip ───────────────────────────
  const counts = useMemo(() => {
    if (!data) return null
    let threats = 0
    let warns = 0
    let hygiene = 0
    for (const ch of data.chapters) {
      if (ch.kind === "security") {
        for (const it of ch.items) {
          if (it.severity === "critical" || it.severity === "high") threats++
          else warns++
        }
      } else hygiene += ch.count
    }
    return { threats, warns, hygiene }
  }, [data])

  const visible = phase === "booting" || phase === "streaming" ? [...(phase === "booting" ? BOOT_LINES.slice(0, bootVisible) : []), ...streamLines] : streamLines
  void visible

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* input row */}
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="font-mono text-xs text-violet-400">audit ▸</span>
        <input
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void startAudit()}
          placeholder="https://github.com/org/repo"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-neutral-200 outline-none placeholder:text-neutral-700"
        />
        {(phase === "booting" || phase === "streaming") && (
          <button
            onClick={skip}
            className="rounded border border-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-500 hover:text-neutral-300"
          >
            skip ⏭
          </button>
        )}
        <button
          onClick={() => void startAudit()}
          disabled={phase === "booting" || phase === "streaming"}
          className="shrink-0 rounded border border-neutral-700 px-2.5 py-0.5 font-mono text-[11px] text-neutral-300 hover:border-emerald-600 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "booting" || phase === "streaming" ? "scanning…" : "▶ audit"}
        </button>
      </div>

      {/* THEATER: stream | focus | graph */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* STREAM */}
        <div className="flex w-full shrink-0 flex-col md:w-[42%]">
          <div className="flex items-center justify-between border-b border-neutral-800/70 px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-600">
              stream
            </span>
            <span className="font-mono text-[10px] tabular-nums text-neutral-600">
              {phase === "streaming" ? `${streamProgress}%` : ""}
            </span>
          </div>

          <div
            ref={scrollRef}
            className="scanlines relative min-h-0 flex-1 overflow-hidden p-3 font-mono text-[11px] leading-[1.7]"
          >
            {phase === "idle" && (
              <p className="text-neutral-600">
                tekan <span className="text-emerald-500">▶ audit</span> — ARCLUX memindai
                struktur, keamanan, dan permukaan serangan secara berurutan.
              </p>
            )}

            {phase === "booting" &&
              BOOT_LINES.slice(0, bootVisible).map((l, i) => (
                <div key={`b${i}`} className={TONE_CLASS[l.tone]}>
                  {l.text}
                </div>
              ))}

            {streamLines.map((l, i) => (
              <div key={i} className={TONE_CLASS[l.tone]}>
                {l.text}
              </div>
            ))}

            {(phase === "booting" || phase === "streaming") && (
              <span className="inline-block h-3.5 w-2 animate-pulse bg-emerald-500 align-middle" />
            )}

            {phase === "done" && error && (
              <div className="mt-2 rounded border border-red-900/60 bg-red-950/30 px-2.5 py-1.5">
                <span className="font-semibold text-red-400">✗ </span>
                <span className="text-red-300/90">{error}</span>
              </div>
            )}
          </div>

          {/* progress rail */}
          {(phase === "streaming" || (phase === "done" && data)) && (
            <div className="h-0.5 shrink-0 bg-neutral-900">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${phase === "done" ? 100 : streamProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* FOCUS */}
        <div className="hidden min-w-0 flex-1 flex-col border-l border-neutral-800/70 md:flex">
          <div className="flex items-center justify-between border-b border-neutral-800/70 px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              focus
            </span>
            {flatItems.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-neutral-600">
                {Math.max(cursor + 1, 0)} / {flatItems.length}
              </span>
            )}
          </div>

          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              {phase === "done" && flatItems.length > 0 ? (
                <>
                  <p className="font-mono text-xs text-neutral-500">
                    {flatItems.length} temuan menunggu
                  </p>
                  <button
                    onClick={() => setCursor(0)}
                    className="rounded border border-emerald-700 px-4 py-1.5 font-mono text-xs text-emerald-400 hover:bg-emerald-950/40"
                  >
                    ▶ mulai walkthrough
                  </button>
                </>
              ) : (
                <p className="font-mono text-xs text-neutral-700">
                  {phase === "done" ? "bersih — nol temuan 🎯" : "menunggu hasil…"}
                </p>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              {/* severity banner */}
              <div
                className={`mb-3 rounded border px-3 py-2 ${
                  active.severity === "critical"
                    ? "border-red-600/60 bg-red-950/40"
                    : active.severity === "high" || active.severity === "error"
                      ? "border-orange-600/50 bg-orange-950/30"
                      : active.severity === "medium" || active.severity === "warning"
                        ? "border-yellow-600/40 bg-yellow-950/20"
                        : "border-neutral-700/60 bg-neutral-900/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-neutral-100">
                    {active.severity}
                  </span>
                  <code className="font-mono text-[11px] text-neutral-400">
                    {active.source === "security" ? active.ruleId : active.checkId}
                  </code>
                  {active.cwe && active.cwe.length > 0 && (
                    <code className="ml-auto hidden font-mono text-[10px] text-neutral-600 sm:block">
                      {active.cwe.join(" · ")}
                    </code>
                  )}
                </div>
              </div>

              <p className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-neutral-200">
                {active.source === "security"
                  ? (active.description ?? active.title ?? "")
                  : active.message}
              </p>

              {(active.location?.filePath || active.filePath) && (
                <code className="mt-3 truncate font-mono text-xs text-neutral-500">
                  ↳ {active.location?.filePath ?? active.filePath}
                  {active.location?.line !== undefined && `:${active.location.line}`}
                </code>
              )}

              <div className="mt-3 flex items-center gap-2 border-t border-neutral-800 pt-3">
                <button
                  onClick={goPrev}
                  disabled={cursor <= 0}
                  className="rounded border border-neutral-700 px-2.5 py-1 font-mono text-[11px] text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
                >
                  ‹ prev
                </button>
                {(active.location?.filePath || active.filePath) && (
                  <button
                    onClick={() =>
                      setOpenFile({
                        path: (active.location?.filePath ?? active.filePath) as string,
                        line: active.location?.line,
                      })
                    }
                    className="rounded border border-blue-800 px-2.5 py-1 font-mono text-[11px] text-blue-400 hover:bg-blue-950/40"
                  >
                    lihat file ↗
                  </button>
                )}
                <button
                  onClick={goNext}
                  disabled={cursor >= flatItems.length - 1}
                  className="ml-auto rounded border border-emerald-700 px-3 py-1 font-mono text-[11px] text-emerald-400 hover:bg-emerald-950/40 disabled:opacity-30"
                >
                  next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* GRAPH (xl+) */}
        {data && active && (
          <div className="hidden min-h-0 w-[26%] shrink-0 border-l border-neutral-800/70 xl:flex xl:flex-col">
            <div className="border-b border-neutral-800/70 px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                graph
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <AuditGraphPane repoUrl={repoInput.trim()} branch={branch} target={focusTarget} />
            </div>
          </div>
        )}
      </div>

      {openFile && (
        <FilePreviewOverlay
          target={openFile}
          repoUrl={repoInput.trim()}
          branch={branch}
          onClose={() => setOpenFile(null)}
        />
      )}

      {/* audit status strip */}
      <div className="flex shrink-0 items-center justify-between border-t border-neutral-800 bg-black/60 px-3 py-1.5 font-mono text-[10px]">
        {counts ? (
          <span className="flex gap-3">
            <span className="text-red-500">THREATS {counts.threats}</span>
            <span className="text-yellow-500">WARN {counts.warns}</span>
            <span className="text-neutral-500">HYGIENE {counts.hygiene}</span>
            {data && <span className="text-emerald-500">HEALTH {data.overallHealth}</span>}
          </span>
        ) : (
          <span className="text-neutral-600">audit</span>
        )}
        <span className="hidden gap-3 text-neutral-600 sm:flex">
          <span><span className="text-neutral-400">←/→</span> navigate</span>
          <span><span className="text-neutral-400">esc</span> close</span>
        </span>
      </div>
    </div>
  )
}