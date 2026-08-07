# ARCLUX — Panduan Tooling & Config

File ini jelasin semua config/tooling yang ada di repo ini, buat apa,
dan cara pakainya. Kalau bingung "ini file buat apa sih", cek di sini dulu.

Baca juga `CONTRIBUTING.md` buat aturan kontribusi kode (struktur project,
cara nambah detector/parser, dll). File ini fokus ke tooling/workflow-nya.

---

## 1. Sistem PROGRES (progres/PROGRES-*.md)

Semua histori kerjaan project dicatet di folder `progres/`, dipecah per
kategori:

| File | Isinya |
|---|---|
| `PROGRES-status-core.md` | Status pipeline, parser, indexer, graph, impact, incremental |
| `PROGRES-status-detectors.md` | Status detectors |
| `PROGRES-status-web.md` | Status apps/web, graph viewer, vendor-ui, theme |
| `PROGRES-status-infra.md` | Status CLI, collaborator tooling, testing, cleanup, dogfood |
| `PROGRES-status-backlog.md` | Backlog |
| `PROGRES-bugs.md` | Bug yang ketemu di kode ARCLUX sendiri + fix-nya |
| `PROGRES-decisions.md` | Keputusan desain/arsitektur ("kita pilih X daripada Y, karena...") |
| `PROGRES-gotchas.md` | Jebakan tooling/environment (Termux, tsconfig, Webpack, dll) — BUKAN bug di kode ARCLUX |
| `PROGRES-collaborators.md` | Siapa pegang tugas apa |

Root `PROGRES.md` itu index doang + "quick decision guide" buat nentuin
entry masuk ke file mana.

### Cara nambah progress entry — PAKAI SCRIPT, JANGAN EDIT MANUAL

```bash
scripts/log-progress.sh <kategori> "judul singkat" "isi progress-nya"
```

Kategori yang valid: `status-core`, `status-detectors`, `status-web`,
`status-infra`, `status-backlog`, `bugs`, `decisions`, `gotchas`,
`collaborators`.

Contoh:
```bash
scripts/log-progress.sh bugs "Fix parser crash on empty file" "Parser TypeScript crash kalau file kosong (cuma license header). Fixed dengan nambahin early-return check di parseTs.ts."
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

`main` dikunci branch protection rule di GitHub. **Nggak bisa push
langsung ke `main`**, harus lewat Pull Request.

### Alur standar:

```bash
git checkout main
git pull origin main
git checkout -b <tipe>/<deskripsi-singkat>

# ... kerjain perubahan ...

git add <file>
git commit -m "pesan commit"
git push origin <tipe>/<deskripsi-singkat>
```

Terus buka link yang muncul di output `git push` (atau ke
`github.com/GSF-001/ARCLUX/pulls`), bikin PR, cek tab "Files changed",
baru merge.

### Penamaan branch:

- `split/...` — motong file besar jadi lebih kecil
- `fix/...` — perbaikan bug/kesalahan
- `update/...` — update konten/dokumentasi
- `feat/...` — fitur/tooling baru
- `docs/...` — dokumentasi doang

### PENTING — verifikasi sebelum merge

Beberapa kali kejadian PR ke-merge tapi hasilnya ternyata versi lama
(stale), bukan commit terakhir yang di-push. Sebelum klik "Merge pull
request" di GitHub:

```bash
git diff main..<branch-lo> --stat
```

Baca hasilnya. Kalau ada file nunjukin banyak `-` (deletion) yang
nggak diduga, cek isi diff-nya beneran (`git diff main..<branch> --
<file>`) sebelum lanjut — bisa jadi nimpa isi lama yang penting.

Setelah merge, **selalu** verifikasi ulang di lokal:

```bash
git checkout main
git pull origin main
cat <file-yang-diubah>
```

Baru hapus branch:
```bash
git branch -D <nama-branch>
```

---

## 3. PR Template (.github/PULL_REQUEST_TEMPLATE.md)

Otomatis muncul isinya tiap kali bikin PR baru di GitHub. Isinya
checklist: udah update PROGRES.md, udah dites di Termux/playground, dll.
Nggak perlu disentuh manual — GitHub yang nampilin otomatis.

---

## 4. Pre-commit hook (.githooks/pre-commit)

Aktif otomatis di repo ini (udah di-set via `git config core.hooksPath
.githooks`). Jalan tiap kali `git commit`.

**Fungsinya:** kalau ada file `progres/PROGRES-*.md` yang di-stage dan
punya header `##` baru **tanpa** tanggal (`YYYY-MM-DD`), commit
**ditolak**. Ini jamin nggak ada lagi entry progress tanpa tanggal.

Kalau commit lo ditolak sama hook ini, pesan errornya bakal kasih tau
file mana dan judul entry mana yang bermasalah. Fix-nya: pakai
`scripts/log-progress.sh` (lihat bagian 1), jangan edit manual.

---

## 5. Commit message template (.gitmessage)

Kalau lo commit **tanpa** `-m` (cuma `git commit` doang), editor bakal
kebuka nunjukin template format commit:

```
# [kategori] Judul singkat (max 50 char)
#
# kategori: status | bug | decision | gotcha | infra | docs
#
# Isi lebih detail (opsional), kenapa perubahan ini dibuat.
```

Baris yang diawali `#` itu comment, otomatis diabaikan git. Tinggal
tulis pesan asli di bawahnya.

Kalau lo commit pakai `-m "pesan"` langsung, template ini nggak kepake
(nggak masalah, itu opsional).

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

