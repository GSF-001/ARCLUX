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
| `PROGRES-status-core.md` | Status: pipeline, parser, indexer, graph, impact, incremental |
| `PROGRES-status-detectors.md` | Status: detectors |
| `PROGRES-status-web.md` | Status: apps/web, graph viewer, vendor-ui, theme |
| `PROGRES-status-infra.md` | Status: CLI, collaborator tooling, testing, cleanup, dogfood |
| `PROGRES-status-backlog.md` | Backlog |
| `PROGRES-bugs.md` | Bugs found in ARCLUX's own code + their fixes |
| `PROGRES-decisions.md` | Design/architecture decisions ("we chose X over Y, because...") |
| `PROGRES-gotchas.md` | Tooling/environment traps (Termux, tsconfig, Webpack, etc) — NOT bugs in ARCLUX's code |
| `PROGRES-collaborators.md` | Who's assigned to what |

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

### Nutup plan lama yang udh dikerjain -- pakai close-plan

Kalau progres/PROGRES-decisions.md punya entry lama yang isinya "planned",
"not yet built", atau "next step", dan lo baru aja selesai ngerjain itu,
jangan cuma nambah entry status baru -- entry lama bakal kelihatan masih
pending selamanya kalau gak disentuh.

Pakai mode close-plan:

```bash
scripts/log-progress.sh close-plan <kategori> "<judul entry lama>" "<judul update baru>" "<isi update>"
```

Ini otomatis nyari entry lama berdasarkan potongan judulnya, nyisipin
pointer status di bawah header lama, dan nambahin entry baru berjudul
UPDATE: <judul> -- implemented di akhir file. Entry lama tidak dihapus,
histori tetep uteh.

Script ini otomatis:
- Ambil tanggal hari ini dari device
- Bikin header `## YYYY-MM-DD — judul`
- Nempelin ke file kategori yang bener

**Kenapa harus pakai script, bukan edit manual?** Karena ada pre-commit
hook (lihat bagian 4) yang bakal nolak commit kalau ada entry baru tanpa
tanggal di header-nya. Script ini jamin format-nya selalu bener.

### Nandain progress entry pakai status -- Not Started / In Progress / Done

Tiap entry sekarang bisa punya status, biar collaborator lain gampang
liat sekilas mana yang masih ide, mana yang lagi dikerjain, mana yang
udah kelar -- tanpa perlu baca isi lengkap tiap entry.

Nambah entry baru dengan status:

```bash
scripts/log-progress.sh <kategori> "judul" "isi" "Not Started"
```

Argumen status itu opsional -- kalau gak diisi, default-nya "Not
Started". Status yang dipakai konsisten cuma 3: `Not Started`, `In
Progress`, `Done`.

Update status entry yang UDAH ADA (misal mulai ngerjain sesuatu, atau
baru kelar), tanpa perlu bikin entry baru:

```bash
scripts/log-progress.sh set-status <kategori> "<judul entry>" "<status baru>"
```

Ini nyari entry berdasarkan potongan judulnya (harus unik), terus ganti
baris `**Status:** ...`-nya di tempat -- isi entry yang lain gak
kesentuh. Kalau entry itu belum punya baris status (entry lama sebelum
fitur ini ada), baris status bakal otomatis ditambahin.

Contoh alur kerja:
```bash
# Mulai ngerjain sesuatu
scripts/log-progress.sh decisions "Refactor X" "Rencana refactor X karena Y" "In Progress"

# ...beberapa jam kemudian, udah kelar...
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

Nentuin siapa otomatis jadi reviewer kalau ada PR masuk. Sekarang
settingnya: semua collaborator (`@Alitindrawan24`, `@xcontcom`,
`@svSeniorEngineer`) jadi reviewer default buat semua file.

Kalau nanti mau dipecah per area (misal si A pegang `apps/web/`, si B
pegang `packages/detectors/`), tinggal edit file itu, tambahin baris:
```
apps/web/            @username
packages/detectors/  @username
```

---

## 7. .editorconfig

Standarin gaya kode antar editor (indentasi, line ending, dll) — biar
nggak beda-beda tiap collaborator pakai editor apa. Kebanyakan editor
modern (VS Code, dll) otomatis baca file ini, nggak perlu setting
manual.

---

## 8. CI (.github/workflows/ci.yml)

Jalan otomatis di server GitHub tiap ada PR ke `main` — nggak jalan di
Termux lo. Ngecek 3 hal:
- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint`
- `npm run test`

Kalau salah satu gagal, PR bakal kelihatan ada tanda gagal di GitHub —
artinya ada yang perlu dibenerin sebelum merge.

---

## 9. Ringkasan alur kerja harian

```bash
# 1. Mulai kerjaan baru
git checkout main
git pull origin main
git checkout -b feat/nama-fitur

# 2. Kerjain, commit seperlunya
git add .
git commit -m "isi progress"

# 3. Catet progress
scripts/log-progress.sh status-infra "judul" "detail progress"
git add progres/
git commit -m "Log progress: judul"

# 4. Push dan buka PR
git push origin feat/nama-fitur
# buka link yang muncul, bikin PR, cek Files changed

# 5. Setelah merge di GitHub
git checkout main
git pull origin main
git branch -D feat/nama-fitur
```

