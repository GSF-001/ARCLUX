// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AuditPanel } from "@/components/script/AuditPanel"

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

// ── Slash commands (opencode-style palette) ────────────────────────────

interface SlashCommand {
  cmd: string
  description: string
  /** Editor content this command loads (template commands). */
  template?: string
  /** Special actions handled imperatively. */
  action?: "run" | "clear" | "reset" | "help" | "audit"
}

const REPO_URL = '"https://github.com/left-pad/left-pad"'

const SLASH_COMMANDS: SlashCommand[] = [
  {
    cmd: "/analyze",
    description: "Load an analyze template — index a repo",
    template: `# analyze() accepts a GitHub URL or local path
let repo = analyze(${REPO_URL})
print("modules: " + tostr(repo.moduleCount))
print("nodes: " + tostr(len(repo.graph.nodes)))`,
  },
  {
    cmd: "/doctor",
    description: "Detector suite — find structural issues",
    template: `let repo = analyze(${REPO_URL})
let findings = doctor(repo)

print("total findings: " + tostr(len(findings)))
print(findings)`,
  },
  {
    cmd: "/security",
    description: "Secrets, unsafe patterns, dangerous APIs",
    template: `let repo = analyze(${REPO_URL})
let report = security(repo)
print("findings: " + tostr(report.total))
print(report)`,
  },
  {
    cmd: "/impact",
    description: "What breaks if a file changes?",
    template: `let repo = analyze(${REPO_URL})
let result = impact(repo, "index.js")

if result.notFound {
  print("module not found")
} else {
  print("direct consumers: " + tostr(len(result.directConsumers)))
  print("affected files: " + tostr(result.totalAffectedFiles))
}`,
  },
  {
    cmd: "/search",
    description: "Search symbols across the repo",
    template: `let repo = analyze(${REPO_URL})
let hits = search(repo, "pad")
print(tostr(len(hits)) + " results")
print(hits)`,
  },
  {
    cmd: "/callgraph",
    description: "Which function calls which",
    template: `let repo = analyze(${REPO_URL})
let calls = callgraph(repo)
print(calls)`,
  },
  {
    cmd: "/basics",
    description: "Language tour — let/print/fn/loop",
    template: `# variables, strings, arithmetic
let name = "flask"
let sizes = [4, 25, 120]

fn describe(count) {
  if count > 10 {
    return "big"
  } else {
    return "small"
  }
}

for s in sizes {
  print(describe(s) + ": " + tostr(s))
}
print("total: " + tostr(sum(sizes)))`,
  },
  { cmd: "/audit", description: "Switch to audit mode — full repo scan theater", action: "audit" },
  { cmd: "/run", description: "Execute the current script", action: "run" },
  { cmd: "/clear", description: "Clear the transcript", action: "clear" },
  { cmd: "/reset", description: "Restore the starter script", action: "reset" },
  { cmd: "/help", description: "List every command", action: "help" },
]

const DEFAULT_SOURCE = SLASH_COMMANDS[0].template ?? ""
const STORAGE_KEY = "arclux-playground-script"

// ── Transcript types ────────────────────────────────────────────────────

interface TranscriptEntryValue {
  kind: "print" | "log"
  text: string
  value?: unknown
}

interface TranscriptBlock {
  id: number
  /** First line of the executed source, shown as the prompt echo. */
  echo: string
  lineCount: number
  entries: TranscriptEntryValue[]
  elapsedMs: number | null
  error?: { message: string; line?: number; column?: number }
}

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

export default function ScriptPlaygroundPage() {
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [hydrated, setHydrated] = useState(false)
  const [blocks, setBlocks] = useState<TranscriptBlock[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [mode, setMode] = useState<"script" | "audit">("script")

  const nextBlockId = useRef(1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef<HTMLInputElement>(null)

  // localStorage restore once on mount. A synchronous setState here IS
  // the correct pattern for external-store (localStorage) rehydration
  // after SSR — lazy initializers would mismatch during hydration.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) setSource(saved)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, source)
  }, [source, hydrated])

  // Auto-scroll transcript to bottom when blocks change.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [blocks])

  const lines = useMemo(() => source.split("\n"), [source])

  const paletteOpen = prompt.startsWith("/")
  const filteredPalette = useMemo(() => {
    if (!paletteOpen) return []
    const q = prompt.slice(1).toLowerCase()
    return SLASH_COMMANDS.filter(
      (c) => c.cmd.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    )
  }, [prompt, paletteOpen])

  useEffect(() => {
    setPaletteIndex(0)
  }, [prompt])

  const appendHelpBlock = useCallback(() => {
    setBlocks((prev) => [
      ...prev,
      {
        id: nextBlockId.current++,
        echo: "/help",
        lineCount: 1,
        elapsedMs: null,
        entries: SLASH_COMMANDS.map((c) => ({
          kind: "log" as const,
          text: `${c.cmd.padEnd(12)} ${c.description}`,
        })),
      },
    ])
  }, [])

  const executeTemplateAction = useCallback(
    async (action: "run" | "clear" | "reset" | "help") => {
      if (action === "clear") {
        setBlocks([])
        return
      }
      if (action === "reset") {
        setSource(DEFAULT_SOURCE)
        setBlocks([])
        return
      }
      if (action === "help") {
        appendHelpBlock()
        return
      }
      if (action === "audit") {
        setMode("audit")
        return
      }
      await run()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appendHelpBlock]
  )

  async function run() {
    if (isRunning || source.trim().length === 0) return
    setIsRunning(true)
    const started = performance.now()
    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      })
      const body = await res.json()
      if (!res.ok) {
        setBlocks((prev) => [
          ...prev,
          {
            id: nextBlockId.current++,
            echo: source.split("\n")[0],
            lineCount: lines.length,
            entries: [],
            elapsedMs: Math.round(performance.now() - started),
            error: {
              message: body.error ?? "Script failed",
              line: typeof body.line === "number" ? body.line : undefined,
              column: typeof body.column === "number" ? body.column : undefined,
            },
          },
        ])
      } else {
        setBlocks((prev) => [
          ...prev,
          {
            id: nextBlockId.current++,
            echo: source.split("\n")[0],
            lineCount: lines.length,
            entries:
              body.entries ??
              (body.output as string[]).map((t) => ({ kind: "log" as const, text: t })),
            elapsedMs: Math.round(performance.now() - started),
          },
        ])
      }
    } catch (err) {
      setBlocks((prev) => [
        ...prev,
        {
          id: nextBlockId.current++,
          echo: source.split("\n")[0],
          lineCount: lines.length,
          entries: [],
          elapsedMs: Math.round(performance.now() - started),
          error: { message: err instanceof Error ? err.message : "Request failed" },
        },
      ])
    } finally {
      setIsRunning(false)
    }
  }

  function applyCommand(command: SlashCommand) {
    setPrompt("")
    if (command.template !== undefined) {
      setSource(command.template)
      textareaRef.current?.focus()
    } else if (command.action) {
      void executeTemplateAction(command.action)
    }
  }

  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!paletteOpen) {
      if (e.key === "Enter") {
        e.preventDefault()
        void run()
        textareaRef.current?.focus()
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setPaletteIndex((i) => Math.min(i + 1, filteredPalette.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setPaletteIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      const chosen = filteredPalette[paletteIndex]
      if (chosen) applyCommand(chosen)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setPrompt("")
    }
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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
      setSource(source.slice(0, start) + "  " + source.slice(end))
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

  return (
    <div className="flex min-h-screen flex-col bg-black p-3 sm:p-5">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-2xl sm:h-[calc(100vh-2.5rem)]">
        {/* title bar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 bg-black/50 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          </span>
          <span className="ml-2 font-mono text-xs text-neutral-400">arclux</span>
          <span className="flex items-center gap-0.5 rounded border border-neutral-800 p-0.5">
            <button
              onClick={() => setMode("script")}
              aria-pressed={mode === "script"}
              className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                mode === "script" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              › script
            </button>
            <button
              onClick={() => setMode("audit")}
              aria-pressed={mode === "audit"}
              className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                mode === "audit" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              ▸ audit
            </button>
          </span>
          {mode === "script" && (
            <button
              onClick={() => void run()}
              disabled={isRunning || source.trim().length === 0}
              className="ml-auto rounded border border-neutral-700 px-2.5 py-0.5 font-mono text-[11px] text-neutral-300 hover:border-blue-500 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRunning ? "running…" : "⏎ run"}
            </button>
          )}
        </div>

        {/* audit mode replaces editor/transcript/prompt entirely */}
        {mode === "audit" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <AuditPanel />
          </div>
        ) : (
        <>
        {/* editor */}
        <div className="flex min-h-[140px] flex-1 overflow-hidden border-b border-neutral-800">
          <div
            ref={gutterRef}
            aria-hidden
            className="shrink-0 overflow-hidden border-r border-neutral-800/60 px-2 py-2 text-right font-mono text-xs leading-relaxed text-neutral-700 select-none"
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <pre
              ref={preRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-2 font-mono text-xs leading-relaxed"
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
              onKeyDown={handleEditorKeyDown}
              onScroll={syncScroll}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              rows={Math.max(lines.length, 8)}
              className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-2 font-mono text-xs leading-relaxed text-transparent caret-blue-400 outline-none"
            />
          </div>
        </div>

        {/* transcript */}
        <div ref={transcriptRef} className="min-h-[120px] flex-1 space-y-4 overflow-auto p-3 font-mono text-xs leading-relaxed">
          {blocks.length === 0 && (
            <p className="text-neutral-600">
              Type <span className="text-violet-400">/</span> below for commands, or hit run to
              execute the script above. Output stacks here.
            </p>
          )}
          {blocks.map((block) => (
            <div key={block.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-blue-500">›</span>
                <span className="truncate text-neutral-400">{block.echo}</span>
                {block.lineCount > 1 && (
                  <span className="text-neutral-700">(+{block.lineCount - 1} lines)</span>
                )}
                {block.elapsedMs !== null && (
                  <span className="ml-auto shrink-0 text-neutral-700 tabular-nums">
                    {block.elapsedMs} ms
                  </span>
                )}
              </div>

              {block.error ? (
                <div className="mt-1 rounded border border-red-900/60 bg-red-950/30 px-2 py-1.5">
                  <span className="font-semibold text-red-400">✗ </span>
                  {block.error.line !== undefined && (
                    <span className="mr-1 font-mono text-red-500/70">
                      line {block.error.line}
                      {block.error.column !== undefined ? `:${block.error.column}` : ""}
                    </span>
                  )}
                  <span className="text-red-300/90">{block.error.message}</span>
                </div>
              ) : (
                <div className="mt-1 space-y-0.5 pl-3">
                  {block.entries.map((entry, i) =>
                    entry.kind === "print" &&
                    entry.value !== undefined &&
                    typeof entry.value === "object" ? (
                      <details key={i} open={block.entries.length <= 3}>
                        <summary className="cursor-pointer select-none text-neutral-200 hover:text-white">
                          {entry.text.length > 90 ? entry.text.slice(0, 90) + "…" : entry.text}
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
                  {block.entries.length === 0 && !block.error && (
                    <div className="text-neutral-600">(no output)</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 text-neutral-500">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-800 border-t-blue-500" />
              executing…
            </div>
          )}
        </div>

        {/* prompt + palette */}
        <div className="relative shrink-0 border-t border-neutral-800">
          {paletteOpen && filteredPalette.length > 0 && (
            <ul className="absolute bottom-full left-0 z-10 max-h-56 w-full overflow-auto border-t border-neutral-800 bg-black/95 backdrop-blur">
              {filteredPalette.map((c, i) => (
                <li key={c.cmd}>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applyCommand(c)
                    }}
                    onMouseEnter={() => setPaletteIndex(i)}
                    className={`flex w-full items-baseline gap-3 px-4 py-1.5 text-left font-mono text-xs ${
                      i === paletteIndex ? "bg-neutral-800/80 text-white" : "text-neutral-400"
                    }`}
                  >
                    <span className={i === paletteIndex ? "text-violet-400" : "text-neutral-500"}>
                      {c.cmd}
                    </span>
                    <span className="truncate text-[11px] text-neutral-500">{c.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="font-mono text-sm text-blue-500">›</span>
            <input
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder='type "/" for commands'
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="w-full flex-1 bg-transparent font-mono text-sm text-neutral-100 outline-none placeholder:text-neutral-700"
            />
          </div>
        </div>

        </>
        )}

        {/* status bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-neutral-800 bg-black/60 px-4 py-1.5 font-mono text-[10px] text-neutral-600">
          <span>
            dsl · <span className="text-neutral-500">v0.2.0</span> ·{" "}
            <span className="text-emerald-600">{lines.length} lines</span>
          </span>
          <span className="hidden gap-3 sm:flex">
            <span>
              <span className="text-neutral-400">ctrl+↵</span> run
            </span>
            <span>
              <span className="text-neutral-400">/</span> commands
            </span>
            <span>
              <span className="text-neutral-400">tab/↑↓</span> select
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}