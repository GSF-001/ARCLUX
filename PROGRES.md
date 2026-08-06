# ARCLUX — Progress Summary

> At the start of any Claude chat, read ALL of these, not just this file:
> `cat PROGRES.md progres/PROGRES-status-core.md progres/PROGRES-status-detectors.md progres/PROGRES-status-web.md progres/PROGRES-status-infra.md progres/PROGRES-status-backlog.md progres/PROGRES-bugs.md progres/PROGRES-decisions.md progres/PROGRES-gotchas.md progres/PROGRES-collaborators.md`
> This file alone is just an index -- it has almost no actual project
> history in it anymore. Skipping the other 4 means missing most of what's
> been learned about this codebase.
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

- [progres/PROGRES-status-core.md](progres/PROGRES-status-core.md) — status: pipeline, parser, indexer, graph, impact, incremental
- [progres/PROGRES-status-detectors.md](progres/PROGRES-status-detectors.md) — status: detectors
- [progres/PROGRES-status-web.md](progres/PROGRES-status-web.md) — status: web (apps/web, graph viewer, vendor-ui, theme)
- [progres/PROGRES-status-infra.md](progres/PROGRES-status-infra.md) — status: CLI, collaborator tooling, testing, cleanup, dogfood
- [progres/PROGRES-status-backlog.md](progres/PROGRES-status-backlog.md) — status: backlog
- [progres/PROGRES-bugs.md](progres/PROGRES-bugs.md) — a real bug was found in already-written code, and what the fix was
- [progres/PROGRES-decisions.md](progres/PROGRES-decisions.md) — "we chose X over Y, here's why" -- design/architecture calls, not bugs
- [progres/PROGRES-gotchas.md](progres/PROGRES-gotchas.md) — environment/tooling traps that aren't bugs in ARCLUX's own code (Termux quirks, tsconfig path resolution, Webpack config, package version pinning, terminal/paste issues)
- [progres/PROGRES-collaborators.md](progres/PROGRES-collaborators.md) — who's assigned to what, check before assuming a file is unclaimed

### Where does my update go? (quick decision guide)

Ask in this order, stop at the first "yes":
1. Is this about a wrong assumption in a PAST PROGRES entry getting
   corrected, or a new package/feature reaching a milestone (done, X/Y
   complete, newly verified)? -> **status** (pick the matching file:
   core / detectors / web / infra / backlog -- see list above)
2. Did something in ARCLUX's OWN code produce wrong output/crash, and you
   fixed it? -> **bugs**
3. Did you choose between two real design options and want the reasoning
   preserved (not just "it works")? -> **decisions**
4. Is the problem actually the terminal/OS/bundler/package manager, not
   ARCLUX's code? -> **gotchas**
5. Are you assigning a task to a collaborator, or updating the status of
   one already assigned? -> **collaborators**

**Closing out an old plan/next-step**: if you just finished something
that an EARLIER entry in `decisions.md` described as "planned", "not yet
built", or a "next step", don't just log a new status entry and move on
-- that leaves the old entry looking unfinished forever. Instead:
1. Add a new dated entry titled `UPDATE: <old title> — implemented` (or
   `— resolved`) describing what actually got built and what's still open.
2. Go back to the OLD entry and add a one-line blockquote pointer at the
   top: `> **[STATUS UPDATE, YYYY-MM-DD]: this plan is now implemented.**
   See "<new entry title>" below.` Don't delete or shorten the old entry
   -- the plan/reasoning stays as historical context, the pointer just
   stops it from being mistaken for still-pending work.

**Still not sure which status file? Put it in PROGRES-status-core.md.**
A slightly-misfiled status entry costs nothing; agonizing over the perfect
category wastes a turn. Nobody needs to re-sort these files -- they're
read together via the cat command above anyway.


### Entry format

Every new entry in ANY of the PROGRES-*.md files must start with a
`## YYYY-MM-DD — Short title` header (ISO date, en-dash, short
descriptive title). No header, no untitled/undated entries -- if you
can't summarize it in one line, the entry needs to be broken up or
you don't understand it well enough yet to log it.

When adding a new update, put it in the file matching its category above.
Keep this index file itself short -- it should only ever have the
preamble/quick-check block plus this section.
