# UE — folder dokumen migrasi (BACA INI DULU, 2 menit)

> **Sumpah folder ini: UE5 TIDAK bikin game ulang dari 0.**
> Yang pindah = MATA (presentasi). Yang tetap = OTAK + BADAN
> (server, aturan, state, blueprint 01–10.V). Bukti lengkap di
> `03-implementasi.md` §1 (daftar file yang TIDAK disentuh).
> Kalau tersesat di tengah migrasi: balik ke sini, ikut urutan baca.

## Urutan baca (jangan loncat)

| # | File | Isi | Kapan dibaca |
|---|---|---|---|
| 0 | `00-migrasi.md` | Keputusan final + arsitektur + tree `apps/game-ue/` + bridge + tabel port + slice 0–6 + biaya + §4K + §7A peta 01–10.V | Sebelum sentuh UE |
| 1 | `01-assets.md` | Pengerahan aset: multi-fungsi, biome, monumen prosedural, POI, FPS tether, ledger gudang | Pas beli/naro aset |
| 2 | `02-asset-pipeline.md` | Badan/otak, manifest, cap 5/30, crafting queue, lifecycle 30-hari + decay karat, gotong-royong, infrastruktur | Pas bangun pipeline user-content |
| 3 | `03-implementasi.md` | PETA TEKNIK: file MMO apa disentuh/tidak, layer apa masuk UE, langkah + checkpoint + jalan pulang | DI BUKA TERUS selama ngoding UE |
| 4 | `04-graphics.md` | SPESIFIKASI GRAFIS: rendering, tier 4K, subsistem, aliran aset, anggaran, acceptance | Pegangan insinyur grafis + artis |

## Kompas satu baris per dokumen

- "Boleh gak ubah X?" → cek `03-implementasi.md` §1–§2. Tidak ada di
  daftar SENTUH = JANGAN sentuh.
- "Aset ini taro mana?" → `01-assets.md` §7 (ledger) + §0.1
  (multi-fungsi).
- "User submit apa?" → `02-asset-pipeline.md` §1 (manifest).
- "Udah bener belum?" → gate di `00-migrasi.md` §8 + checkpoint di
  `03-implementasi.md` §4. Gagal gate = STOP, bukan lanjut.

## Aturan folder (dilindungi creative director)

1. NOL dokumen UE baru tanpa nomor urut + tanpa baris di tabel atas.
2. NOL ide duplikat: tiap klaim BARU wajib tulis sumbernya
   ("baru, sesi X") atau sumber blueprintnya ("05 §9").
3. File-file di sini = UNDANG-UNDANG eksekusi. Langgar = revert.
