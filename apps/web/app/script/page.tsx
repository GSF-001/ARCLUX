// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useState } from "react"
import { postJson } from "@/lib/api"

interface ScriptResponse {
  output: string[]
  results: Record<string, unknown>
}

const DEFAULT_SCRIPT = `# ARCLUX DSL — analyze a repository from a script
# analyze() accepts a local path or a GitHub URL
let repo = analyze("https://github.com/left-pad/left-pad")
print("modules: " + tostr(repo.moduleCount))

let issues = doctor(repo)
print("doctor findings: " + tostr(len(issues)))
`

/**
 * /script — browser playground for the ARCLUX DSL. Runs the program
 * server-side via POST /api/script (runScriptSource) and shows print()
 * output plus emit() results. The sandbox is structural: bindings expose
 * engine analysis only, no fs/network primitives.
 */
export default function ScriptPlaygroundPage() {
  const [source, setSource] = useState(DEFAULT_SCRIPT)
  const [output, setOutput] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  async function handleRun() {
    setIsRunning(true)
    setError(null)
    setOutput(null)
    try {
      const result = await postJson<ScriptResponse>("/api/script", { source })
      setOutput(result.output.length > 0 ? result.output : ["(no output)"])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script failed")
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-black px-4 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-neutral-100">Script playground</h1>
          <span className="text-xs text-neutral-500">
            .arclux programs run server-side — analysis bindings only
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col">
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              rows={18}
              className="w-full flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-200 outline-none focus:border-blue-500"
            />
            <button
              onClick={handleRun}
              disabled={isRunning || source.trim().length === 0}
              className="mt-2 w-fit rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? "Running..." : "Run script"}
            </button>
          </div>

          <div className="rounded-md border border-neutral-800 bg-neutral-950">
            <div className="border-b border-neutral-800 px-3 py-2 text-[10px] uppercase tracking-wide text-neutral-500">
              Output
            </div>
            <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs leading-relaxed text-neutral-300">
              {error
                ? `Error: ${error}`
                : output
                  ? output.join("\n")
                  : "Run a script to see its print() output here."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}