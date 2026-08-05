# ARCLUX Progress — Environment Gotchas

Termux, tsconfig, Webpack, version-pinning quirks. See PROGRES.md for the index.

## Problems that happened before — don't repeat these

- **Dead code piling up**: 2 differently-named files doing the same thing
  (`graph/resolveAlias.ts` vs `indexer/resolveAliases.ts`) because of
  parallel sessions without sync. Lesson: ALWAYS `cat`/`grep` first before
  writing a new file that could overlap. **Same risk still exists** for
  `packages/ui/graphColor.ts` vs `theme/graphColors.ts` — not yet cleaned
  up.
- **`wc -l` is misleading**: a file with just the Apache 2.0 license
  header has a baseline of 8 lines even when empty. The "empty" threshold
  is `≤9`, not `==0`. Always `cat` a suspicious file before recording its
  status in PROGRES.md.
- **Duplicate license headers**: there was once a file with 2 headers (old
  MIT + new Apache stacked) from a mid-stream license change without
  removing the old header first. Already cleaned up manually.
- **Long scripts can silently fail partway through**: the CommandPalette
  session once failed to write a file partway through a heredoc, but the
  earlier steps (installing `cmdk`, creating `fuzzyScore.ts`) still
  succeeded — making it look "done" when it wasn't complete. Lesson: after
  running a multi-step script, verify each step (`cat` the file / `git
  log`), don't assume "ran" means "all succeeded".
- **Termux quirks**: `/tmp` doesn't exist, Turbopack doesn't run on arm64
  (use `--webpack`), git push needs a Personal Access Token, not a
  password.
- **Don't clone reference repos inside `~/arclux`** — they must be at the
  `~` root (`~/git-truck`, `~/madge`, `~/opencode`, `~/research/*`),
  outside the project.

## Running tsc from repo root gives false @/ alias errors for apps/web

`npx tsc --noEmit -p .` from ~/arclux (repo root) uses the ROOT
tsconfig.json, which has no `@/*` path alias configured — that alias only
exists in apps/web/tsconfig.json, scoped to that app. Running the root
check reports 100+ "Cannot find module '@/...'" errors across nearly
every file in apps/web/, none of which are real. The correct check for
apps/web specifically is:

  cd apps/web && npx tsc --noEmit

This was the root cause of issue #51 being filed as a false positive
(input-group.tsx reported as broken from a root-level check, shows zero
errors when checked correctly from apps/web/). If a check from root
surfaces a wall of `@/` alias errors, re-run from apps/web/ before
concluding anything is actually broken.
