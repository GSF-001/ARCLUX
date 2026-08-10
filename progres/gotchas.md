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

## 2026-08-03 — Running tsc from repo root gives false @/ alias errors for apps/web

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

## 2026-08-06 — `main` branch has protection rule, can't push directly

`git push origin main` gets rejected with `GH013: Repository rule
violations... Changes must be made through a pull request`, even after a
clean local fast-forward merge. Workaround: push the feature branch, open
a PR on GitHub, merge from there. Don't assume a local merge to `main` is
enough to publish it.

## 2026-08-06 — GitHub PR merge can use a stale commit if merged before the push finishes propagating

Merging a PR on GitHub right after git push sometimes merges an earlier commit on that branch, not the latest one -- happened twice today and silently reverted fixes to CONTRIBUTING.md and .github/PULL_REQUEST_TEMPLATE.md back to an older, overwritten version. Always run 'git diff main..<branch> --stat' right before merging, and re-verify the actual file contents on main (not just git log) after every merge, especially for files edited more than once in the same PR chain.

## 2026-08-06 — Stray branch-name text landed inside PROGRES.md content

Found literal lines 'split/progres-status', '----', and 'main' sitting inside PROGRES.md's prose (not as code/comments) after a merge -- looked like terminal output or branch names got pasted into a file edit by mistake. Always grep a file for suspicious bare words after any merge that touches a shared doc, not just diff --stat.

## 2026-08-09 — npm install failed with corrupted lockfile; package.json still declares pnpm+turbo

**Status:** Not Started

npm install was failing repo-wide with "Cannot read properties of null (reading matches)". Fixed via rm -rf node_modules package-lock.json, npm cache clean --force, npm install. Separately: package.json currently declares packageManager pnpm@9.15.0 -- project uses pnpm as established in TOOLING.md, this npm troubleshooting was likely done by a session unaware of that. Flagging so a future session does not assume npm without checking TOOLING.md first.

## 2026-08-10 — Vitest does not support Jest-style --runInBand flag

**Status:** Done

pnpm test -- --runInBand fails since Vitest 4.1.10 has no such option. Plain pnpm test is correct for this project: 5 test files passed, 23 tests passed.

## 2026-08-11 — GraphFocusView.tsx and GraphProvider.tsx had not been read since the PROGRES.md entry marking them unverified in-browser

**Status:** Done

A much earlier decisions.md/status entry (GraphMenu consolidation session) explicitly flagged GraphFocusView.tsx as pushed near a chat context limit, typecheck-only, not visually verified in-browser. This session is the first time it was actually exercised by a real user against a real large-fan-in file (25 affected files) -- both bugs found (dead back-button icon, silent 12-item cap) were exactly the kind of thing a typecheck-only "looks done" status hides. Lesson: when a PROGRES entry says "not yet visually verified," treat any bug report against that component as plausible even if the code "looks" complete on read -- do not assume the component is solid just because it compiled and was merged.
