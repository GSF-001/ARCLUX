# ARCLUX MMO Universe — Design Decisions

Keputusan desain untuk produk game ARCLUX. Setiap keputusan dicatat dengan
konteks, pilihan, dan alasan — supaya bisa dilacak & tidak bolak-balik.

---

## D-001 — ARCLUX MMO adalah produk terpisah dari `apps/web`

- **Tanggal:** 2026-08-27
- **Konteks:** Awalnya ada pertanyaan apakah game bisa dibangun di dalam
  `apps/web` (Next.js dashboard). Ternyata game = MMORPG persistent yang butuh
  arsitektur beda kelas dari web dashboard per-user.
- **Keputusan:** Game ARCLUX adalah **produk terpisah**. `apps/web` cuma
  developer bridge (health/impact/provenance, casual). Game jadi
  `apps/game` (client) + `packages/gameserver` (server).
- **Alasan:** MMORPG butuh authoritative server, satu world state untuk semua
  player, sim loop, validasi deterministik — beda fundamental dari web
  dashboard stateless per-request.

---

## D-002 — Lokasi: package terpisah dalam repo (bukan repo baru)

- **Tanggal:** 2026-08-27
- **Konteks:** Mau gak mau game ditaruh di repo terpisah atau monorepo yang ada.
- **Keputusan:** **Package terpisah dalam repo yang sama**:
  - `apps/game` — game client (Electron)
  - `packages/gameserver` — game server authoritative
  - keduanya memakai `packages/universe` (World Model) + `three` + `packages/db`
- **Alasan:** satu repo, familier, reuse `packages/universe` & engine yang ada,
  gak perlu setup monorepo/link baru.

---

## D-003 — Game client: Desktop standalone via Electron

- **Tanggal:** 2026-08-27
- **Konteks:** Rendering 3D universe butuh performa; pilihan desktop stack.
- **Keputusan:** **Electron** (bukan Tauri).
- **Alasan:** seluruh logic udah TypeScript di monorepo — Electron (Node +
  Chromium) nyambung natural, satu bahasa (TS) di mana-mana, gak perlu Rust
  seperti Tauri. Bundle lebih besar tapi effort lebih rendah & mulus sama
  existing TS.

---

## D-004 — Bentuk: MMORPG persistent, engine = ARCLUX

- **Tanggal:** 2026-08-27
- **Konteks:** Sejauh apa game-nya.
- **Keputusan:** **MMORPG beneran** — banyak orang, satu universe, real-time,
  persistent. Engine-nya **ARCLUX** (code-intelligence jadi physics: repo →
  vessel → combat → economy). Bukan di `apps/web`.
- **Alasan:** sesuai blueprint "Repository War Universe" — repo jadi source of
  truth entitas virtual.

---

## D-005 — Multi-shard sejak awal

- **Tanggal:** 2026-08-27
- **Konteks:** Universe satu dunia global vs banyak shard.
- **Keputusan:** **Multi-shard sejak awal** (bukan single instance dulu).
- **Alasan:** tiap komunitas/fleet punya dunia sendiri; arsitektur layanan
  gak bakal ketutup jejak. Flexible untuk skala & komunitas terpisah.

---

## D-006 — Model shard: Region + Jump Gates (mirip EVE)

- **Tanggal:** 2026-08-27
- **Konteks:** Bagaimana shard diorganisir.
- **Keputusan:** **Model A: Region + Gates.**
  - Universe logis dibagi jadi region/sistem.
  - Tiap shard server menangani satu set region.
  - Antar region dihubungkan jump gate (keluar region A → gate → masuk region B).
  - Tiap fleet/komunitas bisa claim region & host server region-nya.
- **Alasan:** paling cocok dengan self-host + visi "universe luas & persistent"
  + desain spatial universe / jump gate yang udah ada
  (`01-spatial-ux.md`). Tiap fleet punya ruang sendiri, gate buat lintas.
- **Catatan MVP:** bisa mulai dengan gate = pindah dunia eksplisit dulu,
  nanti scale ke seamless real-time antar server.

---

## D-007 — Repo = 1 vessel

- **Tanggal:** 2026-08-27
- **Konteks:** Peran repo di dalam dunia game.
- **Keputusan:** Setiap repository = **satu vessel** (kapal) yang bisa
  dijelajah, dikembangkan, diserang, diperbaiki. Sesuai blueprint Layer A-B.
- **Alasan:** konsisten dengan `packages/universe` & blueprint yang udah ada.

---

## D-008 — Simulasi combat/physics: Server authoritative penuh

- **Tanggal:** 2026-08-27
- **Konteks:** Siapa hitung damage/posisi/fisik.
- **Keputusan:** **Server authoritative penuh.** Server compute posisi/damage/
  fisik, client cuma render + local prediction. Input-queue + event replay.
- **Alasan:** adil & anti-cheat — persis Layer I blueprint ("server = referee,
  client = render"). Konsisten dengan `packages/universe/license.ts` dan
  `03-combat.md`.

---

## D-009 — Deployment: Self-host per shard

- **Tanggal:** 2026-08-27
- **Konteks:** Server jalan di mana / model deployment.
- **Keputusan:** **Self-host per shard.** Tiap shard/komunitas bisa host server
  sendiri. Pusat ARCLUX = registry + bridge antar-shard (claim region, list
  server, gate handoff).
- **Alasan:** desentral, tiap fleet bisa mandiri; gak jadi single point of
  failure; cocok Model A (region-owned).
- **Catatan:** fleksibel nanti — dukung juga cloud untuk yang mau.

---

## D-010 — Scope: Full arsitektur

- **Tanggal:** 2026-08-27
- **Konteks:** Sejauh mana digarap.
- **Keputusan:** **Full arsitektur langsung** (bukan vertical slice/demo dulu).
  Rancang & bangun full game server + client skala produksi.
- **Alasan:** visi MMO beneran, biar keputusan matang & arsitektur gak
  melenceng pas scale.

---

## D-011 — Blueprint extension V2 (Community, Social, Ownership)

- **Tanggal:** 2026-08-27
- **Konteks:** Proposal extension 56 poin (community, social connection,
  safe zones, intelligence, battlefield assets, ownership & recovery).
- **Keputusan:** Ditulis sebagai **file blueprint baru**
  `docs/blueprint/06-community-social-ownership.md`. Fokus ke bagian BARU
  (access keys/trust, intel warfare, security boundary, cross-community
  component history, fleet recovery ops, player roles) + cross-reference ke
  yang sudah ada (tidak duplikasi).
- **Alasan:** sebagian besar nuansa (safe zone, community station, wreckage/
  recovery/provenance, component identity) **sudah ada** di blueprint 02/03/04;
  yang benar-benar baru adalah layer social/ownership → dijadikan section 06.

---

## D-012 — Jangan auto-merge PR (standing rule)

- **Tanggal:** terus (konsisten)
- **Konteks:** aturan user sejak awal.
- **Keputusan:** Buat PR tapi **selalu review dulu** — jangan auto-merge.
- **Alasan:** user mau kontrol penuh sebelum merge.

---

## D-013 — Persistent world: server restart ≠ world reset

- **Tanggal:** 2026-08-28
- **Konteks:** proposal Extension V6 (tanpa reset naratif) — apakah restart/
  maintenance menghapus state dunia.
- **Keputusan:** **Server restart ≠ world reset.** State dunia tervalidasi
  dipulihkan setelah restart/maintenance/deployment/crash/migrasi/upgrade
  kompatibel. Sejarah (wars, provenance, lineage, ownership, community/vessel/
  governance/recovery/destruction/diplomatic events) tidak dihapus oleh restart.
  Klien tidak bisa meng-undo perubahan dunia yang sah selama offline.
- **Alasan:** keluar game ≠ keluar dari dunia; state persisten via
  `packages/gameserver/persistence.ts` + `packages/provenance` + `packages/db`.
- **Implementasi:** [08-persistent-world.md](../08-persistent-world.md) +
  `MMO-IMPLEMENTATION.md`.

---

## D-014 — NO player-initiated world pause

- **Tanggal:** 2026-08-28
- **Konteks:** istilah tepat bukan "gada stop", melainkan tidak ada pause dunia
  yang diinisiasi pemain.
- **Keputusan:** **NO PLAYER-INITIATED WORLD PAUSE.** Pemain tidak bisa
  menghentikan/men-jeda dunia. Logout tidak menghentikan world; login kembali
  → lanjut dari state terakhir yang benar-benar terjadi.
- **Pengecualian:** server tetap butuh maintenance/restart teknis — yang
  persisten adalah state dunia (D-013), bukan server itu harus hidup selamanya.
- **Alasan:** konsisten dengan persistent consequence (D-004).

---

## D-015 — Satu region = satu sistem bintang

- **Tanggal:** 2026-08-28
- **Konteks:** skala objek kosmik (planet/bulan/asteroid) dalam region/shard.
- **Keputusan:** **Setiap region = satu sistem bintang** (1 star + planet +
  moon + asteroid belt + backdrop). Jump gate = pindah sistem bintang (nyatu
  D-006).
- **Alasan:** memberi sense of scale ala EVE tanpa mengaburkan keterbatasan
  satu shard; konsisten "shard = region = system".
- **Implementasi:** [01 §2.1](../01-spatial-ux.md) + `arsitektur.md`.

---

## D-016 — Orbit nyata & fase lunar deterministik

- **Tanggal:** 2026-08-28
- **Konteks:** seberapa realistis gerak tata surya & fase bulan.
- **Keputusan:** **Simulasi orbit nyata, deterministik per tick.** Posisi benda
  langit = f(parameter orbit, tick); fase bulan (purnama/sabit/bulan baru) lahir
  dari orbit, bukan state terpisah.
- **Alasan:** realisme MMO (D-004) + semua klien/replica menghitung posisi sama
  → server-authoritative (D-008) & anti-cheat utuh.
- **Implementasi:** [01 §2.3](../01-spatial-ux.md) + `environs.ts`.

---

## D-017 — Environmental collision = damage nyata

- **Tanggal:** 2026-08-28
- **Konteks:** efek nabrak benda langit (asteroid/meteor/planet).
- **Keputusan:** **Nabrak benda COLLIDABLE = damage nyata** yang diputuskan
  server, masuk subsystem damage yang sama (bukan damage terpisah), tercatat
  event + replay; kehancuran → wreckage dengan provenance utuh.
- **Alasan:** dunia adalah ancaman nyata, bukan poster; konsisten behaviour
  damage/combat yang sudah ada.
- **Implementasi:** [03 I.9](../03-combat.md) + `collision.ts`.

---

## D-018 — Dua skala koordinat (system vs local)

- **Tanggal:** 2026-08-28
- **Konteks:** membedakan posisi benda langit vs posisi kapal agar tidak rancu.
- **Keputusan:** **Dua skala, satu region.** Skala system (kerangka dev) untuk
  posisi/orbit benda langit; skala lokal (pemain) untuk posisi/motion kapal.
  Tidak dicampur.
- **Implementasi:** [01 §2.5](../01-spatial-ux.md) + `types.ts` (Vec3).

---

## D-019 — Kapal imun gravitasi + Universal Baseline

- **Tanggal:** 2026-08-28
- **Konteks:** hindari kapal terseret orbit; simpulkan perilaku kapal.
- **Keputusan:** Kapal **imun terhadap gravitasi Newton** (tidak ditarik skala
  system) — bergerak bebas/manuver. Imunitas dijamin oleh **ARCLUX Universal
  Baseline** (kode wajib di awal repo, tidak bisa dihapus) yang juga berisi sistem
  dasar & identitas kapal.
- **Implementasi:** [01 §2.6](../01-spatial-ux.md) + [05 §7.1](../05-vessel-design-dashboard.md).

---

## D-020 — Fisika tata surya pakai hukum nyata (nama ilmiah)

- **Tanggal:** 2026-08-28
- **Konteks:** kedalaman lingkungan tata surya.
- **Keputusan:** Tata surya disimulasikan dengan hukum fisika nyata — gravitasi
  Newton, hukum Kepler, radiasi/energi termal (∝1/r²), batas material &
  melting, solar wind / coronal mass ejection. Nomenklatur ilmiah dipakai (bukan
  istilah buatan) agar bisa diverifikasi. Deterministik per tick (D-008/D-016).
- **Implementasi:** [01 §2.6](../01-spatial-ux.md) + `environs.ts`.

---

## D-021 — Identitas sosial, aliansi & intel-kordinat

- **Tanggal:** 2026-08-28
- **Konteks:** pemain perlu tahu kawan vs lawan; koordinasi armada konflik besar.
- **Keputusan:** Vessel/player tampil dengan **identitas sosial ber-label** (faksi
  + nama kapal + username). **Aliansi** = beberapa community bersekutu. Kapal dapat
  **berbagi titik (kordinat/waypoint/titik kumpul)** ke aliansi; intel mengikuti
  access/trust & bisa bocor. BUKAN sistem pemenang/loser; open world.
- **Implementasi:** [06 §18.6-18.7](../06-community-social-ownership.md) + HUD [01 §20.8-20.9](../01-spatial-ux.md).

---

## D-022 — Mobilisasi terbatas: 2-teleport + cooldown + portal

- **Tanggal:** 2026-08-28
- **Konteks:** kapal yang menerima titik bisa bergerak ke medan konflik.
- **Keputusan:** **2 teleport per aktivasi bantuan** (1 ke titik, 1 balik titik
  asal), **cooldown panjang**, **animasi portal**. Bukan teleport bebas, bukan SOS
  instan (melainkan kordinat yang dibagikan), bukan jump gate navigasi.
- **Implementasi:** [06 §18.8](../06-community-social-ownership.md) + [01 §14](../01-spatial-ux.md).

---

## Keputusan pending / terbuka

- Model gate antar shard: eksplisit (pindah dunia) vs seamless real-time —
  MVP mulai eksplisit, nanti dinaikkan.
- Detail ekonomi in-universe + payment boundary — layer terpisah, belum detail.
- Peran fitur "community projects multi-repo" detail mekaniknya — belum final.
- **Respawn / logout-location policy (D-OPEN):** apakah pemain selalu respawn
  tepat di lokasi logout, dan ada/tidaknya mekanisme respawn/teleport. Belum
  diputuskan — sengaja dibiarkan open (lihat 08-persistent-world.md §15). Jump
  gate/teleport navigasi (01 §14) tetap ada; ini soal kebijakan respawn pemain.
