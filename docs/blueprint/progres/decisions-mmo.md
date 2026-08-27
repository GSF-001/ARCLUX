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

## Keputusan pending / terbuka

- Model gate antar shard: eksplisit (pindah dunia) vs seamless real-time —
  MVP mulai eksplisit, nanti dinaikkan.
- Detail ekonomi in-universe + payment boundary — layer terpisah, belum detail.
- Peran fitur "community projects multi-repo" detail mekaniknya — belum final.
