// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// ── DSL surface (mirrors packages/dsl/lexer.ts + bindings.ts) ──────────

const KEYWORDS = new Set([
  "let", "if", "else", "for", "while", "in", "where", "fn", "return",
  "true", "false", "null", "and", "or", "not", "break", "continue",
])

const BUILTINS = new Set([
  "analyze", "doctor", "check", "graph", "callgraph", "impact", "search",
  "security", "diff", "archdiff", "len", "sum", "mean", "max", "min",
  "sort", "filter", "keys", "values", "first", "last", "exists", "type",
  "tostr", "tonum", "env", "cwd", "extensions", "checkids", "print", "log",
])

const TOKEN_RE =
  /(#[^\n]*)|("[^"\n]*"|'[^'\n]*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*/%<>=!]+)/g

/** Tokenize one line into [text, cssClass] pairs. No deps, Prism-style. */
function tokenizeLine(line: string): [string, string | null][] {
  const out: [string, string | null][] = []
  let last = 0
  for (const m of line.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push([line.slice(last, idx), null])
    const [full, comment, str, num, word, op] = m
    if (comment) out.push([full, "text-neutral-600 italic"])
    else if (str) out.push([full, "text-emerald-400"])
    else if (num) out.push([full, "text-orange-300"])
    else if (word && KEYWORDS.has(word)) out.push([full, "text-violet-400 font-medium"])
    else if (word && BUILTINS.has(word)) out.push([full, "text-sky-400"])
    else if (op) out.push([full, "text-neutral-400"])
    else out.push([full, null])
    last = idx + full.length
  }
  if (last < line.length) out.push([line.slice(last), null])
  return out
}

// ── Examples ────────────────────────────────────────────────────────────

interface Example {
  label: string
  source: string
}

const EXAMPLES: Example[] = [
  {
    label: "Basics — let & print",
    source: `# Hello ARCLUX — variables and printing
let name = "flask"
let version = 1.0
print("Analyzing " + name)
print("version: " + tostr(version))

# builtins are typed values too
print("languages: " + tostr(len(extensions())))`,
  },
  {
    label: "Loop, condition, function",
    source: `# control flow + user-defined functions
fn describe(count) {
  if count > 10 {
    return "big repo"
  } else {
    return "small repo"
  }
}

for i in [1, 2, 3] {
  print("pass " + tostr(i))
}

let sizes = [4, 25, 120]
let total = sum(sizes)
print(describe(total) + ": " + tostr(total) + " units")`,
  },
  {
    label: "Analyze a repository",
    source: `# analyze() accepts a GitHub URL or a local path
let repo = analyze("https://github.com/left-pad/left-pad")
print("modules: " + tostr(repo.moduleCount))
print("graph: " + tostr(len(repo.graph.nodes)) + " nodes")

# print an object → renders as a collapsible tree
print(repo.meta)`,
  },
  {
    label: "Doctor — detector suite",
    source: `# run all detectors, then filter what matters
let repo = analyze("https://github.com/left-pad/left-pad")
let findings = doctor(repo)

print("total findings: " + tostr(len(findings)))

let errors = filter(findings, fn(f) {
  return f.severity == "error"
})
print("errors: " + tostr(len(errors)))
print(errors)`,
  },
  {
    label: "Security scan",
    source: `# secrets, unsafe patterns, dangerous APIs
let repo = analyze("https://github.com/left-pad/left-pad")
let report = security(repo)

print("findings: " + tostr(report.total))
print(report)`,
  },
  {
    label: "Impact analysis",
    source: `# what breaks if this file changes?
let repo = analyze("https://github.com/left-pad/left-pad")
let result = impact(repo, "index.js")

if result.notFound {
  print("module not found")
} else {
  print("direct consumers: " + tostr(len(result.directConsumers)))
  print("affected files: " + tostr(result.totalAffectedFiles))
}`,
  },
]

const DEFAULT_SOURCE = EXAMPLES[0].source
const STORAGE_KEY = "arclux-playground-script"

// ── JSON tree ───────────────────────────────────────────────────────────

function JsonNode({ value, name, depth }: { value: unknown; name?: string; depth: number }) {
  const [open, setOpen] = useState(depth < 1)

  if (value === null || typeof value !== "object") {
    const color =
      typeof value === "string" ? "text-emerald-400"
      : typeof value === "number" ? "text-orange-300"
      : typeof value === "boolean" ? "text-violet-400"
      : "text-neutral-500"
    return (
      <div className="pl-4">
        {name !== undefined && <span className="text-sky-400">{name}: </span>}
        <span className={color}>
          {typeof value === "string" ? `"${value}"` : String(value)}
        </span>
      </div>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>)
  const bracket = Array.isArray(value) ? ["[", "]"] : ["{", "}"]

  return (
    <div className="pl-4">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-left hover:text-neutral-300"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>▸</span>
        {name !== undefined && <span className="text-sky-400">{name}: </span>}
        <span className="text-neutral-500">{bracket[0]}</span>
        {!open && (
          <>
            <span className="text-neutral-600">{entries.length}</span>
            <span className="text-neutral-500">{bracket[1]}</span>
          </>
        )}
        {open && <span />}
      </button>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode key={k} value={v} name={!Array.isArray(value) ? k : undefined} depth={depth + 1} />
          ))}
          <div className="pl-4 text-neutral-500">{bracket[1]}</div>
        </>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

interface ScriptEntryValue {
  kind: "print" | "log"
  text: string
  value?: unknown
}

interface ScriptError {
  error: string
  line?: number
  column?: number
}

export default function ScriptPlaygroundPage() {
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [hydrated, setHydrated] = useState(false)
  const [entries, setEntries] = useState<ScriptEntryValue[] | null>(null)
  const [runError, setRunError] = useState<ScriptError | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  // Restore the user's last script once on mount. A synchronous setState
  // here IS the correct pattern for external-store (localStorage)
  // rehydration after SSR: the server rendered DEFAULT_SOURCE, and the
  // client must swap in the persisted draft before first paint of user
  // content. Lazy useState initializers can't do this safely because
  // they run during hydration too and would mismatch. The save-effect
  // below stays gated on `hydrated` so we never write before restoring.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) setSource(saved)
    setHydrated(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, source)
  }, [source, hydrated])

  const lines = useMemo(() => source.split("\n"), [source])

  const run = useCallback(async () => {
    if (isRunning || source.trim().length === 0) return
    setIsRunning(true)
    setRunError(null)
    setEntries(null)
    setElapsedMs(null)
    const started = performance.now()
    try {
      // Single fetch (not postJson) so the error path can read
      // line/column off the response body without re-running anything.
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      })
      const body = await res.json()
      if (!res.ok) {
        setRunError({
          error: body.error ?? "Script failed",
          line: typeof body.line === "number" ? body.line : undefined,
          column: typeof body.column === "number" ? body.column : undefined,
        })
      } else {
        setEntries(
          body.entries ??
            (body.output as string[]).map((t) => ({ kind: "log" as const, text: t }))
        )
        setElapsedMs(Math.round(performance.now() - started))
      }
    } catch (err) {
      setRunError({ error: err instanceof Error ? err.message : "Script failed" })
    } finally {
      setIsRunning(false)
    }
  }, [isRunning, source])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      void run()
      return
    }
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = source.slice(0, start) + "  " + source.slice(end)
      setSource(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }

  function syncScroll() {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  function loadExample(ex: Example) {
    setSource(ex.source)
    setEntries(null)
    setRunError(null)
  }

  function resetToDefault() {
    setSource(DEFAULT_SOURCE)
    setEntries(null)
    setRunError(null)
    setElapsedMs(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-black px-4 py-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* header row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-neutral-100">Script playground</h1>
          <select
            onChange={(e) => {
              const ex = EXAMPLES.find((x) => x.label === e.target.value)
              if (ex) loadExample(ex)
              e.target.selectedIndex = 0
            }}
            defaultValue=""
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-blue-500"
            aria-label="Load example script"
          >
            <option value="" disabled>
              Load example…
            </option>
            {EXAMPLES.map((ex) => (
              <option key={ex.label} value={ex.label}>
                {ex.label}
              </option>
            ))}
          </select>
          <button
            onClick={resetToDefault}
            className="rounded-md border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
          >
            Reset
          </button>
          <span className="ml-auto hidden text-xs text-neutral-600 sm:block">
            <kbd className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to run
          </span>
        </div>

        {/* panels — stack on mobile, side-by-side from md */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* editor */}
          <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 focus-within:border-blue-600/70">
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
              <span className="font-mono text-[11px] text-neutral-500">script.arclux</span>
              <button
                onClick={() => void run()}
                disabled={isRunning || source.trim().length === 0}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Running…
                  </span>
                ) : (
                  "Run"
                )}
              </button>
            </div>
            <div className="flex max-h-[60vh] min-h-[320px] flex-1 overflow-hidden">
              {/* gutter */}
              <div
                ref={gutterRef}
                className="shrink-0 overflow-hidden border-r border-neutral-800/80 bg-black/40 px-2 py-3 text-right font-mono text-xs leading-relaxed text-neutral-700 select-none"
                aria-hidden
              >
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              {/* code area */}
              <div className="relative min-w-0 flex-1">
                <pre
                  ref={preRef}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-3 font-mono text-xs leading-relaxed break-normal"
                >
                  {lines.map((line, i) => (
                    <div key={i}>
                      {tokenizeLine(line).map(([text, cls], j) => (
                        <span key={j} className={cls ?? undefined}>
                          {text}
                        </span>
                      ))}
                      {"\n"}
                    </div>
                  ))}
                </pre>
                <textarea
                  ref={textareaRef}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onScroll={syncScroll}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  rows={Math.max(lines.length, 18)}
                  className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-3 font-mono text-xs leading-relaxed text-transparent caret-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* output */}
          <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-wide text-neutral-500">
                Output
              </span>
              {elapsedMs !== null && (
                <span className="font-mono text-[11px] tabular-nums text-neutral-600">
                  {elapsedMs} ms
                </span>
              )}
            </div>
            <div className="max-h-[60vh] min-h-[320px] flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
              {isRunning ? (
                <div className="flex items-center gap-2 text-neutral-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-blue-500" />
                  Executing…
                </div>
              ) : runError ? (
                <div className="rounded-md border border-red-900/60 bg-red-950/30 p-3">
                  <p className="text-red-400">
                    <span className="mr-1.5 font-semibold">✗ Error</span>
                    {runError.line !== undefined && (
                      <span className="ml-1 font-mono text-xs text-red-500/70">
                        line {runError.line}
                        {runError.column !== undefined ? `:${runError.column}` : ""}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-red-300/90">{runError.error}</p>
                </div>
              ) : entries ? (
                <div className="space-y-0.5">
                  {entries.map((entry, i) =>
                    entry.kind === "print" &&
                    entry.value !== undefined &&
                    typeof entry.value === "object" ? (
                      <details key={i} open={entries.length <= 3}>
                        <summary className="cursor-pointer select-none text-neutral-300 hover:text-neutral-100">
                          {entry.text.length > 80
                            ? entry.text.slice(0, 80) + "…"
                            : entry.text}
                        </summary>
                        <JsonNode value={entry.value} depth={0} />
                      </details>
                    ) : entry.kind === "log" ? (
                      <div key={i} className="text-neutral-500 italic">
                        {entry.text}
                      </div>
                    ) : (
                      <div key={i} className="whitespace-pre-wrap text-neutral-200">
                        {entry.text}
                      </div>
                    )
                  )}
                  {entries.length === 0 && <span className="text-neutral-600">(no output)</span>}
                </div>
              ) : (
                <span className="text-neutral-600">
                  Run a script to see its output here. Objects from print() render as collapsible
                  trees.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}