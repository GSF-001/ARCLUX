# Collaborators — active assignments

> Tracks who's working on what, so any session (or Mika) can check this
> FIRST before assuming a file/task is unclaimed. This is the human-
> readable companion to the in-file comment rule (see
> decisions.md "issues assigned to a collaborator must also be
> marked in-file") — that rule marks individual files, this file gives
> the overview across all of them.

## Rules for using this file

- Before starting work on any file that looks empty/stub/unclaimed,
  check here first, not just the file itself.
- When assigning a new issue to a collaborator, add an entry below
  AND follow the in-file marking rule from decisions.md.
- When a collaborator's PR merges and closes their issue, move their
  entry to "Completed", don't delete it — keeping history here matters
  more than keeping the list short.
- If a collaborator goes quiet on an assigned issue for a while, note
  that here too (don't just silently reassign or duplicate the work).

## Active assignments

<!-- Format:
### [username] — issue #N
- **Task**: one-line summary
- **Files**: which file(s) this covers
- **Status**: not started / in progress / PR open (#N) / blocked on X
- **Assigned**: date
-->

### mwakidenis — issue #147
- **Task**: Implement 3 remaining apps/web/hooks stubs
- **Files**: `apps/web/hooks/useClipboard.ts`, `useCommandPalette.ts`, `useMediaQuery.ts`
- **Status**: not started
- **Assigned**: 2026-08-07
- **Note**: 4th active collaborator, first assignment. Also independently added CITATION.cff (unprompted, unassigned contribution) before this. Profile suggests frontend/React-heavy background, picked this task to match.

### ManSio — issue #176
- **Task**: Design + implement a shadow/duplicate symbol definition detector
- **Files**: New file under `packages/detectors/` (exact name TBD by ManSio)
- **Status**: not started
- **Assigned**: 2026-08-08
- **Note**: 5th active collaborator. Came in via a detailed GitHub comment (not a cold invite) — starred the repo, asked sharp questions about incremental re-analysis, and suggested this exact detector idea based on real experience building mscodebase-intelligence (a mature MCP codebase-intelligence server for Zed, 1032 tests, 13.9k+ lines in src/core/ alone). Deliberately NOT added to CODEOWNERS yet -- want to see this first PR before granting default-reviewer access, even though the background looks strong.

## Removed from CODEOWNERS (not from assignments)

Alitindrawan24, xcontcom, and svSeniorEngineer removed as default PR
reviewers on 2026-08-09 after 3-5 days with zero commits/PRs against
their assigned issues (#53, #3, #50, #2). They keep their issue
assignments -- this only removes their default-reviewer status so PRs
don't sit waiting on review from inactive accounts. Re-add to
CODEOWNERS if/when they become active again.

## Completed

<!-- Move entries here once merged, keep the same format, add:
- **Merged**: PR #N, date
-->

## 2026-08-08 — mwakidenis contributed CITATION.cff unprompted

**Status:** Done

4th active collaborator independently added CITATION.cff (Citation File Format) before being assigned anything. Linked it from README's License section. Assigned issue #147 (apps/web/hooks stubs) separately the same day.
