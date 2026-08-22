// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Language coverage section. Counts come from packages/parser/ — every
// grammar-backed language goes through the shared tree-sitter loader or
// the TS Compiler API and emits the same import/export contract.
// Keep this list in sync with parserRegistry (27 languages, 0.2.0).

const compilerApiLanguages = [
  {
    name: "TypeScript / TSX",
    indexer: "TypeScript Compiler API",
    status: "Full support: imports, exports, re-exports",
  },
  {
    name: "JavaScript",
    indexer: "TypeScript Compiler API",
    status: "Full support: JS/JSX/CJS/MJS, CommonJS exports",
  },
]

const treeSitterLanguages = [
  "Python", "Go", "Java", "PHP", "Ruby", "Rust", "C++", "C#", "Bash",
  "C", "Dart", "Elixir", "Kotlin", "Lua", "Objective-C", "OCaml",
  "Scala", "Solidity", "Swift", "Vue", "Zig", "Elm", "ReScript",
]

const plannedLanguages = ["More grammars from tree-sitter-wasms", "Manifest-only refinements"]

export function LanguageCoverage() {
  const total = compilerApiLanguages.length + treeSitterLanguages.length
  return (
    <section className="border-t px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Coverage
        </div>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {total} languages today, one graph shape.
        </h2>
        <p className="mb-10 max-w-xl text-muted-foreground">
          Every language parser emits the same import/export contract, so
          the dependency graph, detectors, and impact analysis work
          identically regardless of which language a file is written in.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {compilerApiLanguages.map((lang) => (
            <div key={lang.name} className="rounded-lg border p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">{lang.name}</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-500">
                  active
                </span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{lang.status}</p>
              <div className="flex items-center justify-between border-t pt-3 text-xs">
                <span className="text-muted-foreground">indexer</span>
                <span className="font-mono">{lang.indexer}</span>
              </div>
            </div>
          ))}

          <div className="rounded-lg border p-5 sm:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium">{treeSitterLanguages.length} languages via web-tree-sitter</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-500">
                active
              </span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Shared tree-sitter loader + config-driven parser factory — one
              wasm per grammar, cached per process, vendored overrides where
              the npm builds are stale.
            </p>
            <div className="flex flex-wrap gap-1.5 border-t pt-3">
              {treeSitterLanguages.map((lang) => (
                <span
                  key={lang}
                  className="rounded-full bg-emerald-500/5 px-2.5 py-1 font-mono text-xs text-emerald-600"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-dashed p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Next up</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {plannedLanguages.map((lang) => (
              <span
                key={lang}
                className="rounded-full border px-2.5 py-1 font-mono text-xs text-muted-foreground"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}