# ARCLUX Progress — Detectors

See PROGRES.md for the index. Split by topic from the original PROGRES-status.md.

## 2026-08-03 — ✅ DONE — detectors (10/18)

1. `detectCircularDependency.ts` — DFS cycle detection, adapted from `madge`
2. `detectUnusedExports.ts` — traversal strategy adapted from `knip`,
   fully re-implemented using `ResolvedImport`/`resolvedReExports` on
   `ModuleInfo`
   - **Limitation**: no reference-extraction pass (can only detect "never
     imported", not "imported but unused"). Namespace imports are treated
     as automatically "using everything". Aliased re-exports aren't chained
     correctly (`RawExport` only stores the final name). Not yet
     entry-file-aware (`resolveRoutes.ts` is still empty → false positives
     on files like Next.js `page.tsx`).
3. `detectOrphanFiles.ts` — file-level version of point 2 (nothing imports
   this file at all). Subject to the same entry-file caveat.
4. `detectLargeModules.ts` — flags files above a byte threshold (default
   15,000). Verified against the `arclux` repo itself: 0 results currently
   because the largest file in the repo (`file-tree.tsx`, 511 lines) is
   only 12,840 bytes, still under the threshold — not a bug, the
   threshold just hasn't been triggered yet.
5. `detectDuplicateModules.ts` — groups files by content hash.
   - **Incident already fixed**: initial threshold (`minSizeBytes = 200`)
     was too small. An empty stub file (license header + 1 comment line)
     in this repo turned out to be 263 bytes, not below 200 as assumed
     when the comment was written. This caused 149 stub files to get
     grouped into one fake "duplicate group" when tested against the real
     repo (not caught in `python-demo`, which only has 6 files). Threshold
     raised to 300. Still a fragile byte-based heuristic — `FileInfo` has
     no `lineCount` or `content`, only `sizeBytes`/`hash`, so if the
     license header format ever changes, this threshold can go stale
     again.
6. `detectSharedModules.ts` — flags high fan-in files (importedBy count).
   Informational, not a "problem". Verified: found
   `packages/shared/types.ts` (25 importers), `packages/repository/Repository.ts`
   (23 importers) in the `arclux` repo itself — makes sense.
7. `detectIndexFiles.ts` — flags barrel files (index.ts) that mix
   re-exports with their own definitions.
   - **Overlap note**: `packages/repository/Module.ts` already has
     `isBarrelFile()`/`isEntryPoint()` with a similar concept. Not yet
     checked whether there's logic duplication — worth verifying before
     writing the next convention detector that might touch the same area.

Verified twice: against `playground/python-demo` (small fixture) AND
against the `arclux` repo itself via `npx tsx apps/cli/index.ts doctor .`
(15,630 lines of real code) — the latter is what caught the threshold bug
above, which the small fixture alone did not reveal.

8. `detectLayerViolation.ts` — rule-matching concept (from-pattern /
   to-pattern regex on folder path) adapted from sverweij/dependency-cruiser
   (MIT), src/validate/match-folder-dependency-rule.mjs. Not a port —
   dependency-cruiser supports arbitrary user-defined rules with regex
   capture groups; this is a small fixed set of 2 ARCLUX-specific rules
   (packages/* can't import apps/*, packages/shared/* can't import sibling
   packages/*) against ARCLUX's own ModuleInfo/ResolvedImport shape, no
   group-capture machinery. Verified with a positive control (planted a
   fake violation, confirmed detection, reverted) — 0 violations in
   `arclux` itself currently.
9. `detectDeadCode.ts` — ARCLUX-original, NOT adapted from knip despite
   investigating knip first (knip has no "dead code" issue type at all —
   its IssueType union is granular: files/exports/types/enumMembers/etc,
   no umbrella bucket). Deliberately scoped to NOT duplicate
   detectOrphanFiles or detectUnusedExports: flags a module that IS
   imported by something (not orphaned) but where EVERY one of its own
   exports is unused (per detectUnusedExports) — i.e. likely only ever
   imported for a side effect. Composes detectUnusedExports's output
   rather than re-deriving usage data, so there's one source of truth for
   "is this export used." Verified with a positive control (planted a
   fake side-effect-only import, confirmed detection, reverted) — 0
   findings in `arclux` itself currently.

Also verified end-to-end via `doctor.ts` (9/9 detectors running together,
not just tested one by one in isolation) against `playground/python-demo`
and against the `arclux` repo itself.

10. `detectEntryPoints.ts` — ARCLUX-original, positive classifier for
    orphaned modules (importedBy === 0) that match a known entry-point
    convention (Next.js App Router page/layout/loading/error/route files,
    apps/cli/index.ts). Informational only — does not modify or suppress
    detectOrphanFiles/detectUnusedExports findings, just lists known-good
    matches alongside them for cross-checking. Verified against `arclux`
    itself: 25 findings, all correct (every app/**/page.tsx, layout.tsx,
    loading.tsx, error.tsx, route.ts under apps/web/app, plus
    apps/cli/index.ts).

Also verified end-to-end via `doctor.ts` (10/10 detectors running
together) against `playground/python-demo` and against the `arclux` repo
itself.

**Remaining 8 still at 0%**: `detectComponentConvention`, `detectFeatureStructure`,
`detectMissingExports`, `detectRepositoryPattern`, `detectRouteConvention`,
`detectStoryConvention`, `detectTestConvention`, `detectUnusedFiles`.

## 2026-08-05 — Update — detectors 18/18 (100%), 2 production bugs NOT YET FIXED

packages/detectors/* is fully 18/18. Verified via scripts/testPlayground.ts
(now calls all 18 detectors, runs against the fixture OR the repo itself
via `npx tsx scripts/testPlayground.ts .`).

**PRODUCTION BUG, NOT YET FIXED**: detectRouteConvention found that
apps/web/app/api/impact/route.ts AND apps/web/app/api/search/route.ts
don't export any HTTP method (GET/POST/etc) — both endpoints are likely
non-functional if hit.

Other findings: detectRepositoryPattern found a package-level cycle
packages/indexer <-> packages/graph. detectMissingExports found 9 shadcn
files (button.tsx etc.) not re-exported via components/ui/index.ts.
detectUnusedExports still has false positives on React components (not
yet using the detectEntryPoints filter like detectUnusedFiles does).


## 2026-08-09 — detectAmbiguousSymbolResolution wired into doctor.ts; tests/detector.test.ts added

**Status:** Done

detectAmbiguousSymbolResolution existed since an earlier PR but was never called from doctor.ts or anywhere in the pipeline, so findings were invisible to users. Wired in following the same severity-aware print pattern as cycles/unusedExports. Also adds tests/detector.test.ts, the FIRST test file in the project (vitest, 4 tests, all passing): case-insensitive test-dir matching, src-test segment-boundary non-match, single-definition non-flagging, re-export skipping.

## 2026-08-14 — Entry-point false positives eliminated (issue #4)

> **[STATUS UPDATE, 2026-08-14]: the 2026-08-05 entry below said
> "detectUnusedExports still has false positives on React components
> (not yet using the detectEntryPoints filter)" — that is now FIXED.**

**Status:** Done

detectUnusedExports and detectOrphanFiles now build an entry-module set
from `indexer/resolveRoutes.ts`'s `getEntryModuleIds()` (App Router
convention, matches regardless of importers) plus
`detectEntryPoints.ts` (CLI entry, orphan classifier) and skip those
modules entirely. Next.js page.tsx/route.ts files and apps/cli/index.ts
no longer appear as unused-export/orphan findings. 8 regression tests
added to tests/core-detectors.test.ts; doctor.ts's note about the
"entry files aren't fully filtered out yet" caveat removed.

 feat/parsers-528
## 2026-08-20 — 5 new language parsers wired (7 → 12 languages)

**Status:** Done

parsePhp/parseRuby/parseRust/parseCpp/parseCSharp implemented and registered in ensureParsersRegistered (pipeline.ts). Previously 8-line stubs — the wasm grammars were already in node_modules (tree-sitter-wasms has 37 grammars), only the extraction code was missing.

- Shared loader added: packages/parser/core/treeSitterLoader.ts — single wasm-path lookup + per-grammar cache (replaces the copy-pasted findWasmPath pattern from parsePython.ts, same no-require.resolve() rule).
- PHP: use statements (incl. group use), function/class/interface/trait/enum exports. parsePhp.ts was previously deferred pending issue #53 (parsePhpRoutes) — that issue is CLOSED, so the general parser is now safe to write.
- Ruby: require/require_relative/load, class/module/method exports.
- Rust: use declarations, pub-only exports (private items excluded).
- C++: #include (angle + quoted), class/struct/enum exports.
- C#: using directives, class/interface/struct/enum/record + public methods only.
- DSL impact: extensions() grew 9 → 19 automatically (registry-driven auto-discovery proof), no DSL changes needed.

6 new tests in tests/new-parsers.test.ts + 2 in tests/dsl.test.ts → suite 675→683, typecheck clean.

## 2026-08-20 — Orphan code got classification + integration suggestions (19 → 20 detectors)

**Status:** Done

Two additions, verified end-to-end on ~/flask (25 orphan findings):

1. **Orphan classification** (detectOrphanFiles.ts, additive — nothing removed):
   - New `OrphanClassification`: `dead` (leftover — delete it) / `unwired` (should be connected) / `ambiguous`.
   - `classifyOrphan()` decision priority (fixed after a tie bug, see bugs.md): story-pattern name → `ambiguous`; backup/scratch name (`BACKUP_NAME`/`SCRATCH_NAME` regexes) → `dead`; has sibling modules that are imported → `unwired`; no exports + no imported siblings → `dead`; else `ambiguous`.
   - Each finding now carries `classification` + `evidence[]` (exact sibling importers etc.). `sharedNamePattern` exported + shared by both detectors.

2. **detectOrphanIntegration.ts** (detector #20, checkId `orphanIntegration`):
   - For unwired/ambiguous files, suggests WHERE they should be imported: the folder's barrel index (if any), or the shared importer of same-kind siblings (pattern-group weighting, confidence bump when sibling kind matches).
   - Suggestion shape: `{filePath, confidence, score, reason, viaSiblings}` — score = fraction of imported siblings, capped at 1; duplicate importedBy edges deduped; self-suggestion excluded.
   - Wired into runDoctor as `orphanIntegration` (warning severity; `info` for dead files). Shell now reports "20 built-in" (updated shell.test.ts + tests/README.md).

Real-repo result on ~/flask: 25 orphans → 7 ambiguous / 11 dead / 7 unwired; 5 with integration suggestions; best suggestion `views.py → src/flask/app.py` (high 0.69 via 11 siblings). 12 new tests in tests/orphan-integration.test.ts → suite 641→653, typecheck clean.
ARCLUX.main

## 08-20 — 13 parser baru (12 → 25 bahasa, 38 extension)
- Batch #529: bash, c, dart, elixir, kotlin, lua, objc, ocaml, scala, solidity,
  swift, vue, zig — semua lewat `makeTreeSitterParser()` factory config-driven
  (packages/parser/core/makeTreeSitterParser.ts), tiap bahasa ~40 baris config
  bukan copy-paste machinery. 13 test di tests/new-parsers-529.test.ts.
- vue parser beda: ekstrak `<script>` → parse ulang pakai TS Compiler API
  (extractImportsJs/extractExportsJs) + export default objek literal.
- BUG REAL ketemu: web-tree-sitter TIDAK aman buat Language.load() konkuren —
  21 parser di-register bareng = race "Incompatible language version 0".
  Fixed di treeSitterLoader.ts: semua load lewat chain serial (loadChain).
  GOTCHA: jangan pernah load grammar wasm paralel.
- SupportedLanguage + LanguageDetector diperluas (12 → 25 bahasa).
- Suite: 696/696. Typecheck clean.
