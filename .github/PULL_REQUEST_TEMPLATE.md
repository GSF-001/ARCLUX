## What changed

<!-- Summarize what changed and why -->

## How was this verified

<!-- tsc --noEmit alone is NOT enough for logic changes.
Explain how it was actually verified: run against which playground/* fixture,
or dev server + curl, etc. See PROGRES.md for the verification patterns
used in this project. -->

## Checklist

- [ ] `npx tsc --noEmit -p apps/web/tsconfig.json` (if touching apps/web)
- [ ] Tested against at least 1 fixture in `playground/` (if touching parser/detector/pipeline)
- [ ] PROGRES.md updated if this changes the status of a previously empty/stub file
- [ ] Doesn't duplicate existing file/logic (checked first with `grep`/`cat`)
- [ ] Updated relevant `progres/PROGRES-*.md` file with a dated entry (`## YYYY-MM-DD — title`)
- [ ] Ran `scripts/log-progress.sh` instead of hand-editing PROGRES files, where applicable
- [ ] Tested on Termux (or noted why not applicable)
- [ ] No `empty` files introduced (check via the empty-file scan in `PROGRES.md`)
