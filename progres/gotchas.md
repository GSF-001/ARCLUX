# ARCLUX Progress — Environment Gotchas

Termux, tsconfig, Webpack, version-pinning quirks. See PROGRES.md for the index.

## Problems that happened before — don't repeat these

- **Dead code piling up**: 2 differently-named files doing the same thing
  (`graph/resolveAlias.ts` vs `indexer/resolveAliases.ts`) because of
  parallel sessions without sync. Lesson: ALWAYS `cat`/`grep` first before
  writing a new file that could overlap. The same class of risk existed
  for `packages/ui/graphColor.ts` vs `theme/graphColors.ts` — **cleaned
  up 2026-08-14 (issue #11): the stub was deleted, `theme/graphColors.ts`
  is the single source.**
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
- **Backticks inside double-quoted shell args get executed**: a commit
  message or `gh pr create --body` written with `` `code` `` spans inside
  double quotes is shell-substituted — the span is eaten and
  "command not found" noise lands in the message (PR #365, 2026-08-14;
  had to `--amend` + force-push + `--body-file` to clean up). Lesson:
  PR bodies go through `--body-file <file>`; commit messages through
  `git commit -F -` with a heredoc; never backticks in double-quoted
  shell text.

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

 main
## 2026-08-13 — Two main-like branches causing sync confusion

**Status:** Not Started

Repo has both 'origin/main' and 'origin/ARCLUX.main' as branches. This session repeatedly hit 'fatal: couldn't find remote ref main' during git checkout/pull sequences, and packages/editor/ + packages/diagnostics/ appeared to vanish between commands even after being written and committed. Root cause suspected: local checkout/pull steps intermittently targeted or got confused between these two branches, leaving local main stale relative to origin/main while work was actually preserved on feature branches. Fix applied: always 'git fetch origin' then 'git reset --hard origin/main' before trusting local file listings, rather than assuming local main == remote main. Needs a real decision: rename or delete one of the two main-like branches so this class of bug can't recur.

 docs/log-today-progress-v2
## 2026-08-13 — Default branch repo adalah ARCLUX.main, bukan main

**Status:** Not Started

git remote show origin menunjukkan HEAD branch repo ini ARCLUX.main. Sempat push beberapa commit (scaffold platform layer + docs map) ke main tanpa sadar itu bukan branch default. Ketauan pas GitHub nawarin Compare antara main dan ARCLUX.main. Fix: isi main digabung ke ARCLUX.main. Selalu cek git remote show origin | grep 'HEAD branch' di awal sesi baru.

## 2026-08-13 — Default branch repo adalah ARCLUX.main, bukan main

**Status:** Not Started

git remote show origin menunjukkan HEAD branch repo ini ARCLUX.main. Sempat push beberapa commit (scaffold platform layer + docs map) ke main tanpa sadar itu bukan branch default. Ketauan pas GitHub nawarin Compare antara main dan ARCLUX.main. Fix: isi main digabung ke ARCLUX.main. Selalu cek git remote show origin | grep 'HEAD branch' di awal sesi baru.

## 2026-08-13 — Repo default branch is ARCLUX.main, not main

`git remote show origin` menunjukkan HEAD branch repo ini adalah
`ARCLUX.main`, bukan `main`. Sempat push beberapa commit (platform
layer scaffold + docs map) ke `main` tanpa sadar itu bukan branch
default, jadi hasilnya nggak langsung kelihatan sebagai kerjaan utama di
GitHub. Ketauan pas GitHub nawarin "Compare" antara `main` dan
`ARCLUX.main` dan base-nya ke-set `ARCLUX.main`.

Fix: konten `main` digabung ke `ARCLUX.main` (jadi `ARCLUX.main`
sekarang superset). Selanjutnya kerja langsung dari `ARCLUX.main`.
Selalu cek dengan `git remote show origin | grep "HEAD branch"` di awal
sesi baru sebelum push, supaya nggak kejadian lagi.
ARCLUX.main

## 2026-08-14 — main vs ARCLUX.main divergence confirmed -- work from ARCLUX.main

**Status:** Not Started

CONFIRMED (previously only suspected): origin/main and origin/ARCLUX.main are NOT the same branch and have diverged significantly. ARCLUX.main is the actively-maintained branch (has packages/runtime/, 263 more files, collaborator work) and has already merged all of main's history in (see commit 'Merge pull request #320 from GSF-001/main'). main is stale/behind. Any session doing 'git checkout main && git pull' will get a stale tree missing packages/runtime/ and other recent work, causing false 'file not found' errors that look like data loss but are actually just being on the wrong branch. FIX: always work from ARCLUX.main going forward -- 'git checkout ARCLUX.main && git pull origin ARCLUX.main' -- until someone with repo admin access consolidates the two branches into one. Do not assume 'main' is current without checking origin/ARCLUX.main's commit count first.

## 2026-08-14 — RESOLVED: main deleted, only ARCLUX.main remains (issue #355)

**Status:** Done

Verified via `git ls-remote origin` + GitHub API: `refs/heads/main` no longer exists on the remote. Only ARCLUX.main remains, it is the default branch (origin/HEAD -> ARCLUX.main) and is protected. The divergence class from the 08-14 entry above cannot recur. Issue #355 can be closed. Working rule stays the same: work from ARCLUX.main.

## 2026-08-15 — Bare 'docs/' in .gitignore silently blocked docs-site/docs/* from ever being committed

**Status:** Done

.gitignore had a bare 'docs/' pattern intended only for root's docs/ (MCP tooling output, see the comment above it). Gitignore patterns without a leading slash match at ANY depth, so this silently ignored every file under docs-site/docs/ too -- git add reported no error, files just never got staged. This caused PR #399 to merge without docs-site/docs/how-to-use.md even though the commit message claimed it was included; the file sat uncommitted on disk and the docs site never updated. Root cause found by noticing 'git log --oneline -- <path>' returned empty after a claimed merge, then 'git add' throwing a silent ignored-file hint. Fixed by anchoring the pattern to /docs/ (root only). LESSON: after any docs-site/docs/* change, verify with 'git log --oneline -1 -- <path>' after merge, don't just trust the push/merge succeeding -- gitignore can silently drop files with zero error output.

## 2026-08-15 — CI failures caught late: MDX angle-bracket parsing + ESLint no-explicit-any/cascading-setState not checked before merge

**Status:** Done

Two separate CI failures happened after merges this session because local verification only ran tsc --noEmit, never the full CI suite (pnpm run lint, docusaurus build): (1) docs-site/docs/how-to-use.md had bare <daemonId>/<port> placeholders -- MDX parses < as JSX tag start, broke docs-build with 'Expected a closing tag'. Fixed by escaping to &lt;/&gt;. (2) Explorer.tsx's allDiagnostics used any[] (3x no-explicit-any) and a second useEffect calling setState based on the first effect's state (cascading-render lint rule). Fixed with a typed interface + useMemo instead of a second effect. LESSON: tsc --noEmit passing does NOT mean CI passes -- ESLint and docs build are separate checks with different rules (no bare <text> in .md files under docs-site/docs/, no any, no setState-in-effect chains). Check 'gh run list --limit 1 --json conclusion' after every push that touches apps/web or docs-site/docs/, don't assume merge success means CI green.

## 2026-08-15 — TWO parallel doc sites exist: Mintlify (.app) and Docusaurus (.site) -- adding a page needs BOTH

**Status:** Done

arclux-os.mintlify.site is Docusaurus (docusaurus build, deployed to GitHub Pages via .github/workflows, nav controlled by docs-site/sidebars.js, pages live under docs-site/docs/*.md). arclux-os.mintlify.app is actual Mintlify hosting (reads docs-site/docs.json for nav, pages live as root-level docs-site/*.mdx files, e.g. docs-site/architecture.mdx not docs-site/docs/architecture.md). These are NOT the same site with two domains -- they are two independently maintained doc systems that happen to look similar. Adding a new doc page requires: (1) the content file in BOTH locations (docs-site/docs/NAME.md for Docusaurus, docs-site/NAME.mdx for Mintlify), (2) registered in BOTH sidebars.js (Docusaurus) AND docs.json (Mintlify). Missing either causes a 404 on that specific site while the other works fine, which is confusing to debug without knowing both sites exist. GitHub Pages also needs to be manually enabled once via repo Settings > Pages > Source > GitHub Actions (was 'currently disabled', causing 'Resource not accessible by integration' on the deploy job even though the build job succeeded).
