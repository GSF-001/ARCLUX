# 07 — ARCLUX STUDIO (isi planet, bukan game baru)

> Status: **SPEC-FINAL (eksekusi: fase UE, setelah 10.V DONE).**
> Induk: `02-asset-pipeline.md` (klaim/crafting/lifecycle — DIPAKAI, tidak diulang),
> `00-migrasi.md` (server tetap, UE presentasi), `05-hukum-kota.md` (founder/yurisdiksi),
> `03-implementasi.md` (kontrak mirror).
> Prinsip satu kalimat: **1 universe, banyak koloni; penemu set rule, pendatang isi; Studio = bungkus `packages/*`.**
> Anti-duplikasi: klaim = 02 §8.5/§9, wanted = 05 §2, combat = 06 + `combat.ts`. File ini HANYA: sandbox, kuota, split uang, deploy.

## 1. Model (FINAL)
- 1 planet luas mil-mil = ribuan koloni 100×100m. Bukan 1 planet = 1 orang.
- Penemu planet = founder (contoh: Mars cyberpunk). Founder tulis `world.json` rule (biome, pajak koloni, larangan). Pendatang bikin koloni di dalamnya via claim yang SAMA kayak 02.
- Pindah planet = `gate.ts` handoff 2-fase antar `WorldRegion`. Planet sepi = cost ~0 (chunk streaming klien), rame = region sendiri. Tidak ada server bengkak sentral.

## 2. Sandbox (tidak bisa ditawar)
- Kode Studio TIDAK PERNAH tulis state langsung. Semua lewat intent → `validator.ts` → `simulation.ts` 10Hz → snapshot. File jahat = reject + alasan.
- Koloni = service di `packages/kernel:ServiceRegistry.ts + SignalBus.ts`, di-schedule `packages/scheduler`, dijalankan `packages/runtime`. Bukan fork universe.
- Nulis dunia: `packages/editor + language + parser + dsl` (`.arclux/world.json`: rule, spawn table, misi, toko). Cek dunia: `packages/detectors + rules + indexer + graph` (poly/VRAM/duplikat/moderasi). Simpan: `packages/db + provenance + storage + lineage` (siapa bangun apa, rollback per-koloni).

## 3. Kuota per-planet (anti jebol cap 02)
- Cap 02 (Besar 5 / Kecil 30 per pemain) TETAP. Tambahan: quota planet + cost index ala EVE — makin rame sistem makin mahal/makin lama antre. Cap founder tidak bisa menutup planet (maks petak per pemain 02 §9.4 berlaku di dalam planet orang).
- Koridor umum (jalan, spawn, garis pantai 10m publik 02 §8.6) tidak dapat diklaim founder maupun pendatang.

## 4. Uang dev (FINAL)
- Dev jualan map/senjata/misi via Company Store yang SAMA (06 §9): dev 90% + treasury dunia 5% + founder planet 5%. Harga dev bebas (server validasi ≥0), pajak otomatis.
- Top-up OC = beli HAK PAKAI (06 doktrin 3). Item Studio tetap `itemId` unik + bisa dicuri/hancur — tidak ada item abadi dev.

## 5. Deploy beku + perang (FINAL)
- Deploy koloni = snapshot beku (anti-bait-and-switch 02 §2): update = submit + rakit ulang + scaffold = target raid.
- Koloni hancur = puing + salvage (02 §10). Invasi planet orang = perang terbuka (05 + 02 §10). Jailbreak/prison tetap 05.
- Founder tidak bisa hapus koloni orang sepihak — cabut = lepas dari rule planet (koloni jadi wilderness claim), bukan delete.

## 6. Kontrak C++ (mirror, tambah item — bukan ubah existing)
- `FArcluxColony { colonyId, planetId, founderId, ruleHash, claimId }` ← `world.json` + claim record.
- Intent baru (key SAMA dua klien): `colony_claim`, `colony_submit`, `colony_rollback`, `studio_publish`, `studio_fork`.
- Acceptance: publish → validator → staging → palet → ghost → antre → dunia (02 §8.1 SAMA); rollback 1 koloni tanpa reset universe; split 90/5/5 terbukti di log server.
