# scripts/

Standalone utility scripts, run with `npx tsx scripts/<name>.ts`. Not
part of the production pipeline (that's `packages/engine/pipeline.ts`).

For `log-progress.sh` specifically (a shell script, not TypeScript), see
`TOOLING.md` section 1 — it's part of the core PROGRES logging workflow,
documented there in full rather than duplicated here.

| Script | What it does | Status |
|---|---|---|
| `testManifests.ts` | Manual verification: runs each manifest parser against a real manifest file (go.mod, Cargo.toml, etc) copied to `~/manifest-samples`, prints results for eyeball-checking | Working |
| `testPlayground.ts` | Runs the full pipeline against `playground/*` fixture repos | Working |
| `checkCollaboratorMarkers.ts` | Detects files referenced in an assigned GitHub issue that don't have an in-file comment mentioning the issue number | Working |
| `build.ts` | Unclear purpose — `package.json`'s `"build"` script uses `turbo run build` directly, not this file. Empty, not wired to anything. | Not started |
| `benchmark.ts` | Intended to measure `analyzeLocalDirectory()` performance across repo sizes | Not started, see issue #75 |
| `generateFixtures.ts` | Intended to auto-generate or pull test fixture files | Not started |
| `release.ts` | Unclear purpose, not wired to anything | Not started |
| `log-progress.sh` | Appends a dated entry to the correct `progres/PROGRES-*.md` file, required by the pre-commit hook (`.githooks/pre-commit`) which rejects undated entries. Run with `scripts/log-progress.sh <category> "title" "body"`, not `npx tsx`. See `TOOLING.md` section 1 for full usage including `close-plan` mode. | Working |

Before writing a new script, check this table — if something already
does what you need, extend it instead of duplicating.
