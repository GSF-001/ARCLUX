# ARCLUX — Tooling & Config Guide

This file explains all the config/tooling in this repo, what it's for,
and how to use it. If you're wondering "what is this file for", check here first.

Also read `CONTRIBUTING.md` for code contribution conventions (project
structure, how to add a detector/parser, etc). This file focuses on
tooling/workflow.

---

## 1. PROGRES system (progres/PROGRES-*.md)

All project work history is logged in the `progres/` folder, split by
category:

| File | Contents |
|---|---|
| `status-core.md` | Status: pipeline, parser, indexer, graph, impact, incremental |
| `status-detectors.md` | Status: detectors |
| `status-web.md` | Status: apps/web, graph viewer, vendor-ui, theme |
| `status-infra.md` | Status: CLI, collaborator tooling, testing, cleanup, dogfood |
| `status-backlog.md` | Backlog |
| `bugs.md` | Bugs found in ARCLUX's own code + their fixes |
| `decisions.md` | Design/architecture decisions ("we chose X over Y, because...") |
| `gotchas.md` | Tooling/environment traps (Termux, tsconfig, Webpack, etc) — NOT bugs in ARCLUX's code |
| `collaborators.md` | Who's assigned to what |

The root `PROGRES.md` is just an index + "quick decision guide" for
figuring out which file an entry belongs in.

### How to add a progress entry — USE THE SCRIPT, DON'T EDIT MANUALLY

```bash
scripts/log-progress.sh <category> "short title" "progress details"
```

Valid categories: `status-core`, `status-detectors`, `status-web`,
`status-infra`, `status-backlog`, `bugs`, `decisions`, `gotchas`,
`collaborators`.

Example:
```bash
scripts/log-progress.sh bugs "Fix parser crash on empty file" "TypeScript parser crashed on empty files (license header only). Fixed by adding an early-return check in parseTs.ts."
```

### Closing out an old plan -- use close-plan

If progres/decisions.md has an old entry that says "planned",
"not yet built", or "next step", and you just finished that work, don't
just add a new status entry -- the old entry will look pending forever
if left untouched.

Use close-plan mode:

```bash
scripts/log-progress.sh close-plan <category> "<old entry title>" "<new update title>" "<update body>"
```

This automatically finds the old entry by a substring of its title,
inserts a status pointer below the old header, and appends a new entry
titled UPDATE: <title> -- implemented at the end of the file. The old
entry isn't deleted, history stays intact.

The script automatically:
- Gets today's date from the device
- Builds a `## YYYY-MM-DD — title` header
- Appends it to the right category file

**Why use the script instead of editing manually?** Because there's a
pre-commit hook (see section 4) that will reject a commit if a new entry
is missing a date in its header. The script guarantees the format is
always correct.

### Tagging progress entries with status -- Not Started / In Progress / Done

Every entry can now have a status, so collaborators can see at a glance
which ones are still ideas, which are in progress, which are done --
without reading the full content of each entry.

Adding a new entry with a status:

```bash
scripts/log-progress.sh <category> "title" "body" "Not Started"
```

The status argument is optional -- if omitted, it defaults to "Not
Started". Only 3 consistent statuses are used: `Not Started`, `In
Progress`, `Done`.

Updating the status of an EXISTING entry (e.g. starting work on
something, or just finishing it), without creating a new entry:

```bash
scripts/log-progress.sh set-status <category> "<entry title>" "<new status>"
```

This finds the entry by a substring of its title (must be unique), then
replaces its `**Status:** ...` line in place -- the rest of the entry is
untouched. If the entry doesn't have a status line yet (an old entry
from before this feature existed), a status line is added automatically.

Example workflow:
```bash
# Start working on something
scripts/log-progress.sh decisions "Refactor X" "Plan to refactor X because of Y" "In Progress"

# ...a few hours later, it's done...
scripts/log-progress.sh set-status decisions "Refactor X" "Done"
```

---

## 2. Git workflow — branch protection

`main` is locked by a branch protection rule on GitHub. **You can't push
directly to `main`**, everything goes through a Pull Request.

### Standard flow:

```bash
git checkout main
git pull origin main
git checkout -b <type>/<short-description>

# ... make your changes ...

git add <file>
git commit -m "commit message"
git push origin <type>/<short-description>
```

Then open the link that appears in the `git push` output (or go to
`github.com/GSF-001/ARCLUX/pulls`), open a PR, check the "Files changed"
tab, then merge.

### Branch naming:

- `split/...` — breaking a large file into smaller ones
- `fix/...` — bug/mistake fix
- `update/...` — content/documentation update
- `feat/...` — new feature/tooling
- `docs/...` — documentation only

### IMPORTANT — verify before merging

There have been a few cases where a PR got merged but the result turned
out to be a stale version, not the latest pushed commit. Before clicking
"Merge pull request" on GitHub:

```bash
git diff main..<your-branch> --stat
```

Read the output. If a file shows a lot of unexpected `-` (deletions),
check the actual diff content (`git diff main..<branch> -- <file>`)
before continuing -- it might be overwriting something important.

After merging, **always** verify locally again:

```bash
git checkout main
git pull origin main
cat <changed-file>
```

Then delete the branch:
```bash
git branch -D <branch-name>
```

---

## 3. PR Template (.github/PULL_REQUEST_TEMPLATE.md)

Automatically shows up every time you open a new PR on GitHub. Contains
a checklist: PROGRES.md updated, tested on Termux/playground, etc.
No need to touch it manually -- GitHub displays it automatically.

---

## 4. Pre-commit hook (.githooks/pre-commit)

Active automatically in this repo (already set via `git config
core.hooksPath .githooks`). Runs on every `git commit`.

**What it does:** if a staged `progres/PROGRES-*.md` file has a new `##`
header **without** a date (`YYYY-MM-DD`), the commit is **rejected**.
This guarantees no more dateless progress entries.

If your commit gets rejected by this hook, the error message will tell
you which file and which entry title is the problem. The fix: use
`scripts/log-progress.sh` (see section 1), don't edit manually.

---

## 5. Commit message template (.gitmessage)

If you commit **without** `-m` (just `git commit` alone), an editor
opens showing the commit format template:

```
# [category] Short title (max 50 char)
#
# category: status | bug | decision | gotcha | infra | docs
#
# More detail (optional), why this change was made.
```

Lines starting with `#` are comments, automatically ignored by git. Just
write the actual message below them.

If you commit with `-m "message"` directly, this template isn't used
(that's fine, it's optional).

---

## 6. CODEOWNERS (.github/CODEOWNERS)

Determines who's automatically a reviewer when a PR comes in. Current
setting: all collaborators (`@Alitindrawan24`, `@xcontcom`,
`@svSeniorEngineer`) are default reviewers for all files.

If you want to split by area later (e.g. person A owns `apps/web/`,
person B owns `packages/detectors/`), just edit that file and add a
line:
```
apps/web/            @username
packages/detectors/  @username
```

---

## 7. .editorconfig

Standardizes code style across editors (indentation, line endings,
etc) so it's not inconsistent depending on which editor each
collaborator uses. Most modern editors (VS Code, etc) read this file
automatically, no manual setup needed.

---

## 8. CI (.github/workflows/ci.yml)

Runs automatically on GitHub's servers for every PR to `main` -- doesn't
run on your Termux. Checks 3 things:
- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint`
- `npm run test`

If any of these fail, the PR will show a failing status on GitHub --
meaning something needs to be fixed before merging.

---

## 9. Daily workflow summary

```bash
# 1. Start new work
git checkout main
git pull origin main
git checkout -b feat/feature-name

# 2. Work, commit as needed
git add .
git commit -m "progress content"

# 3. Log progress
scripts/log-progress.sh status-infra "title" "progress detail"
git add progres/
git commit -m "Log progress: title"

# 4. Push and open PR
git push origin feat/feature-name
# open the link that appears, open a PR, check Files changed

# 5. After merging on GitHub
git checkout main
git pull origin main
git branch -D feat/feature-name
```

