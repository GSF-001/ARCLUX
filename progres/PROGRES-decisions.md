# ARCLUX Progress — Design Decisions

Why things were built the way they were. See PROGRES.md for the index.

## Update — GitHub infra + features/graph decision

**Repo infrastructure added**: branch ruleset on `main` (PR required, no
direct push — verified by testing it against ourselves), PR + issue
templates (`.github/`), 10 GitHub Issues created from open items in this
file, release tag `v0.1.0-alpha` published, `CONTRIBUTING.md` rewritten
(was stale: said pnpm/turbo, said detectors don't exist — now says npm,
18/18 detectors, references playground/ testing pattern).

Also removed `turbo.json` (0 bytes, unused leftover — project uses npm
directly, `turbo` command never actually run against this repo).

**apps/web/features/graph/* decision**: `useGraph.ts` implemented as a
thin re-export of `GraphProvider.tsx`'s `useGraphContext()`. The other 4
files (`graphStore.ts`, `graphEvents.ts`, `useGraphLayout.ts`,
`useGraphSelection.ts`) are DELIBERATELY left as documentation-only stubs
— `GraphProvider.tsx` already owns all graph state (transform, positions,
dimensions, selection) via React Context. Do NOT implement a separate
store/hooks layer here; it would create two sources of truth for the same
state. Same class of risk as the `packages/ui/graphColor.ts` /
`theme/graphColors.ts` naming collision noted earlier.


## Update — parseTsx.ts and parseTsConfig.ts confirmed intentionally empty

Verified, not just assumed: `packages/parser/typescript/parseTsx.ts` and
`parseTsConfig.ts` will stay empty stubs permanently, not because they're
"not done yet" but because their functionality already lives elsewhere:

- `.tsx` parsing: handled inside `parseTs.ts` itself via
  `ts.ScriptKind.TSX` (checked its `extensions` field and ScriptKind
  selection logic directly).
- tsconfig.json parsing: handled inside
  `packages/indexer/resolveAliases.ts`, which reads tsconfig.json /
  jsconfig.json directly (with comment/trailing-comma stripping) for
  path-alias resolution.

Both files now have a comment explaining this, so a future session
doesn't attempt to implement duplicate logic in either of them — same
class of risk previously flagged for `packages/ui/graphColor.ts` vs
`theme/graphColors.ts` (that one is still an open risk; these two are now
resolved/documented).
