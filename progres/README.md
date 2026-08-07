# progres/

Isinya histori dan status project ARCLUX, dipecah per kategori biar
gampang dicari. Kalau males baca semua, ini penjelasan singkat tiap
file:

| File | Isinya |
|---|---|
| `PROGRES-status-core.md` | Status pipeline: parser, indexer, graph, impact, incremental |
| `PROGRES-status-detectors.md` | Status 18 detector (circular deps, dead code, dll) |
| `PROGRES-status-web.md` | Status apps/web: dashboard, graph viewer, komponen UI |
| `PROGRES-status-infra.md` | Status CLI, tooling collaborator, testing, cleanup |
| `PROGRES-status-backlog.md` | Kerjaan yang belum diambil siapa-siapa |
| `PROGRES-bugs.md` | Bug yang ketemu di kode ARCLUX sendiri + cara fix-nya |
| `PROGRES-decisions.md` | Keputusan desain: "kita pilih X daripada Y, karena..." |
| `PROGRES-gotchas.md` | Jebakan tooling/environment (Termux, tsconfig, dll) -- bukan bug di kode ARCLUX |
| `PROGRES-collaborators.md` | Siapa pegang tugas apa |

Setiap entry di file-file ini sekarang bisa punya status
(`Not Started` / `In Progress` / `Done`) -- cek `TOOLING.md` di root
buat cara nambah/update entry pakai `scripts/log-progress.sh`.

Buat gambaran lengkap kondisi project sebelum mulai kerja, baca
`PROGRES.md` di root repo -- itu index-nya, sekaligus panduan nentuin
update baru masuk file mana.
