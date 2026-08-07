// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Card grid layout style (badge + large mono numbers + bordered cards)
// inspired by archgraph.dev's "16 languages, one graph" section — visual
// pattern only, not their copy or their numbers. ARCLUX genuinely
// supports 2 languages right now (TypeScript via the TS Compiler API,
// Python via web-tree-sitter); this deliberately does NOT pad the count
// or claim coverage that doesn't exist. Update this list only when a new
// packages/parser/<language>/ implementation is actually done and
// verified — see PROGRES.md for what's still 0%.

const languages = [
  {
    name: "TypeScript",
    indexer: "TypeScript Compiler API",
    status: "Full support: imports, exports, re-exports",
  },
  {
    name: "Python",
    indexer: "web-tree-sitter",
    status: "Full support: imports, exports (heuristic)",
  },
]

const plannedLanguages = [
  "Go",
  "Java",
  "Rust",
  "C#",
  "PHP",
  "Ruby",
  "C++",
  "JavaScript",
]

export function LanguageCoverage() {
  return (
    <section className="border-t px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Coverage
        </div>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          2 languages today, one graph shape.
        </h2>
        <p className="mb-10 max-w-xl text-muted-foreground">
          Every language parser emits the same import/export contract, so
          the dependency graph, detectors, and impact analysis work
          identically regardless of which language a file is written in.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {languages.map((lang) => (
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
        </div>

        <div className="mt-6 rounded-lg border border-dashed p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Planned, not yet implemented</span>
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
