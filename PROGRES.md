# ARCLUX — Progress Summary

> Paste this file at the start of any Claude chat (or `cat PROGRES.md`) so
> Claude immediately understands the project status without needing it
> re-explained from scratch. Update this file after every major milestone.
>
> Check current empty-file status:
> ```bash
> cd ~/arclux
> find apps packages scripts tests -type f \( -name "*.ts" -o -name "*.tsx" \) \
>   -not -path "*/node_modules/*" | while read f; do
>   echo "$(wc -l < "$f") $f"
> done | sort -n
> ```
> Threshold: a file with only the Apache 2.0 license header has a baseline
> of **8 lines**, not 0 — so "empty" means ≤9 lines, not `==0`. Always `cat`
> a suspicious file before trusting the `wc -l` number alone.

## What this is

ARCLUX = a codebase analysis tool. Clone repo → parse → index → build
dependency graph → interactive browser visualization. Goal: see how
files/modules connect to each other, what gets affected if you change
something, and which conventions are being violated (e.g. "added a
Next.js page but forgot to register the route").

## Stack

- Monorepo: `apps/web` (Next.js 16, App Router, Webpack — **not** Turbopack,
  unsupported on Termux arm64), `packages/*` (core logic, framework-agnostic)
- UI: React, Tailwind v4, shadcn/ui (Base UI variant) + Aceternity + Magic UI
- Graph rendering: SVG + `d3-force` (physics layout)
- Parsing: TypeScript Compiler API (TS/TSX) + `web-tree-sitter` (Python)
- Environment: Termux on Android, not desktop
- License: Apache 2.0 (`LICENSE` + `NOTICE` at root, per-file header)

---

## Split into category files

This file used to contain everything. It's now split for readability:

- [progres/PROGRES-status.md](progres/PROGRES-status.md) — feature completion status, sync updates
- [progres/PROGRES-bugs.md](progres/PROGRES-bugs.md) — bugs found and their fixes
- [progres/PROGRES-decisions.md](progres/PROGRES-decisions.md) — design decisions and why
- [progres/PROGRES-gotchas.md](progres/PROGRES-gotchas.md) — environment quirks (Termux, tsconfig, Webpack, version pinning)

When adding a new update, put it in the file matching its category above.
Keep this index file itself short -- it should only ever have the
preamble/quick-check block plus this section.
