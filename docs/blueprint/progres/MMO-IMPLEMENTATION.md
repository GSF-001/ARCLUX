# ARCLUX MMO — IMPLEMENTATION MAP (anti-lupa)

> **Ini "otak" scaffolding.** Sebelum ngoding MMO, baca ini dulu: cek status
> tiap modul, tahu udah dibikin apa, tinggal isi apa, dan mau diarahin ke mana.
> JANGAN ngulang bikin yang udah ada — baca §Status dulu.
>
> Semantic: ✅ = berfungsi & terverifikasi · 🚧 = kerangka/parsial · ⬜ = kosong.
> Tiap file yang di-update harus isi §Arah sesuai checklist di bawah ini.

Update terakhir: 2026-08-28 (PR #582 gameserver core merged; scaffolding relay/game).

---

## 1. Peta modul (gambaran besar)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ARCLUX PLATFORM (developer tooling — SUDAH JADI, bukan game)              │
│  apps/web · apps/cli · packages/engine·universe·db·daemon·provenance.      │
├────────────────────────────────────────────────────────────────────────────┤
│                            GAME MMO (product terpisah)                     │
│                                                                            │
│  packages/universe  ✅ World Model (VesselModel, System, License)          │
│  packages/gameserver 🚧 Authoritative server (world/validator/sim/combat)  │
│     ├─ gate.ts      🚧 Jump gate routing antar region                      │
│     ├─ netcode.ts   🚧 Client<->server transport (intent queue)            │
│     ├─ persistence.ts 🚧 Save/load region state (db + RecoveryManager)     │
│  packages/relay     🚧 Shard registry + gate handoff + identity            │
│  apps/game          🚧 Electron client (3D render + input + net)           │
└────────────────────────────────────────────────────────────────────────────┘
```

Keputusan acuan (lihat `docs/blueprint/progres/decisions-mmo.md` D-001..D-012):
server-authoritative penuh (D-008), self-host per shard (D-009), multi-shard Region
+ Gates (D-005/D-006), repo = 1 vessel (D-007). Desain: `docs/blueprint/0X-*.md`.

---

## 2. Status & arah tiap modul

### 2.1 `packages/universe` ✅ (SRC = vessel identity & source of config)
- **Udah ada**: `types.ts` (VesselModel/SystemState/SubsystemId/LicenseTier),
  `stats.ts` (deriveBaseStats/mergeManifest/buildVesselModel), `license.ts`
  (checkComponent/validateVesselComponents 3-tier), `schema.ts` (validateManifest/
  capOverride), `connect.ts` (connectRepository). Barrel `index.ts`. PR #580.
- **Arah berikutnya**: stabil — dipakai gameserver. Tambah hanya kalau model
  vessel butuh field baru (mis. identity layer §18 blueprint 06: repository id,
  community ref). **Perubahan di sini menyebar** ke gameserver — review dulu.

### 2.2 `packages/gameserver` 🚧 (server authoritative — PR #582 core)
**Udah ada (berfungsi, terverifikasi via smoke test):**
- `types.ts` — Vec3, GameEntity, VesselEntity, StationEntity, RegionState,
  GameEvent, PlayerIntent
- `world.ts` — WorldRegion entity registry (spawn/move/remove vessel & station,
  proximity `entitiesWithin`, snapshot, regionFromState, distanceBetween, safe-zone data)
- `validator.ts` — validateIntent (identity/owner/range/cooldown/safe-zone/
  license reuse universe)
- `simulation.ts` — SimulationEngine (enqueue/step deterministic tick, moveToward,
  integratePhysics, cooldown, replayLog, computeEntityHash)
- `combat.ts` — applyCombatIntent, damage per subsystem, DAMAGE_CEILING
- Barrel `index.ts`

**Belum ada — kerangka di file ini (tinggal isi):**
- `gate.ts` 🚧 — jump gate routing & handoff antar region. TODOs di dalam file.
- `netcode.ts` 🚧 — transport client↔server (intent in, events out), reuses
  SimulationEngine.enqueue. TODOs.
- `persistence.ts` 🚧 — save/load RegionState via `packages/db` + RecoveryManager. TODOs.

**Arah (prioritas isi berikutnya):**
1. `gate.ts` — handoff vessel antar region (D-006 jalur eksplisit dulu, seamless nanti)
2. `persistence.ts` — simpan doang bisa langsung pakai prove of `snapshot`
   (ini juga dasar V6 persistent world: load→reconstruct→resume, 08 §13)
3. `netcode.ts` — pasang pas `apps/game` klien pertama
4. V4 capability (07): usage_count + component_condition + depletion di
   validator/simulation; batas 2 kapal induk
5. V5 HUD registry (01 §20.2): expose capabilities[] ke renderer
6. Cosmic environs (01 §2.3): `environs.ts` orbit integrator deterministik +
   `SystemBodies[]`; lalu `collision.ts` (03 I.9) & `cosmic-event.ts`
7. Cosmic render (01 §2/§22): planet/moon fase lunar, belt, meteor, backdrop + HUD

### 2.3 `packages/relay` 🚧 (shard registry + gate handoff + identity lintas shard)
**Kerangka dibuat, file**: `index.ts`, `registry.ts`, `gate.ts`, `identity.ts`, `types.ts`.
**Arah**: 
- registry: daftar shard server + claim region (mapping region id -> server addr)
- gate: koordinasi handoff vessel antar region milik server yang beda
- identity: pemetaan player id lintas shard (global handle -> per-shard entity)
Semua TODOs dicatet di file masing-masing. Belum ada konsumen — dimulai saat
butuh 2+ server (multi-shard) atau handoff.

### 2.4 `apps/game` 🚧 (Electron client 3D)
**Kerangka dibuat**: `src/main/` (Electron main), `src/renderer/` (3D + input +
net), `index.ts`, `package.json`. **Arah**:
- bootstrap Electron + jendela
- renderer pakai `three` (sama kayak apps/web GraphCanvas3D) buat render vessel
- input -> netcode -> game server; render event dari server (anti-cheat D-008)
- belum ada executable; jalan via `npx electron .` sekali kerangka net terisi

### 2.5 Modul platform yang DIPAKAI MMO (jangan dibikin ulang)
| Paket | Peran di MMO |
|---|---|
| `packages/engine/pipeline.ts` | analisis repo → vessel base stats (input `buildVesselModel`) |
| `packages/db` | persistensi world/region/vessel (dipakai gameserver.persistence) |
| `packages/provenance` | history vessel/component/ownership |
| `packages/daemon` + `watcher` | auto-update vessel saat repo berubah |
| `three` + GraphCanvas3D | fondasi render 3D (dipakai apps/game renderer) |
| `packages/shell` | extension user-space (optional) |

---

## 3. Checklist implementasi (urutan build plan, tiap item = PR, jangan auto-merge)

### PR #580 ✅ universe — SUDJAH
### PR #582 ✅ gameserver core (world/validator/sim/combat) — SUDJAH
### PR berikutnya (urutan)
- [ ] gameserver: `gate.ts` jump gate routing (handoff eksplisit)
- [ ] gameserver: `persistence.ts` save/load region (db + RecoveryManager)
- [ ] gameserver: `netcode.ts` transport intent/events
- [ ] `packages/relay`: registry + gate handoff + identity
- [ ] `apps/game`: bootstrap Electron + 3D render vessel dari RegionState
- [ ] integrasi: `arclux connect` → vessel masuk universe → jump gate → station/community
- [ ] dynamic safe-zone / governance state (blueprint 06 §13-16) — modifikasi validator
- [ ] V4 special capability: batas 2 kapal induk + limited activation 3x + depletion
      (07 §5/§7-9/§17/§21) — perpanjang validator + simulation
- [ ] V4 component-based capability: usage/component_condition, event log
      activate_special_capability (07 §10/§22, reuse 03 I.8 replay)
- [ ] V4 provenance lineage: component survive ship/destruction (07 §13-15, reuse
      `packages/provenance`)
- [ ] V5 Universal Cockpit: capability registry + HUD discovery (01 §20, renderer)
- [ ] V6 Persistent world: load→reconstruct region (regionFromState)→resume (08 §13,
      reuse persistence.ts); no player-initiated pause (D-014)
- [ ] Cosmic environs: `environs.ts` orbit integrator deterministik per tick +
      `SystemBodies[]` (star/planet/moon/asteroid/backdrop) (01 §2.3, arsitektur)
- [ ] Cosmic collision: `collision.ts` tabrakan vessel vs body COLLIDABLE → damage
      subsystem (reuse 03 I.2/I.7/I.9); cukup parah → wreckage (04)
- [ ] Cosmic event: `cosmic-event.ts` generator acak (meteor shower, badai bintang /
      musim berbasis orbit, aurora, puing anomali) → event + replay (03 I.8)
- [ ] Cosmic render: renderer draw planet/moon (fase lunar), belt, meteor, backdrop
      body + LOD (01 §2/§22); HUD command-interface (01 §20)

> Desain acuan V4/V5/V6: `07-special-capabilities.md` · `01-spatial-ux.md §20` ·
> `08-persistent-world.md` · keputusan D-013/D-014 di `decisions-mmo.md`.
>
> Desain acuan cosmic: `01-spatial-ux.md §2/§22/§24` · `03-combat.md I.9` ·
> `04-wreckage-history.md` · `arsitektur.md` (environs/collision/cosmic-event).
>
> Setiap kali selesai isi satu modul: update §2 status file + checklist §3,
> lalu commit/PR terpisah.

---

## 4. Boundary & gotcha (jangan dilanggar)

- **Client TIDAK pernah jadi otoritas** (D-008, invariant I-1). Semua keputusan
  combat/ownership lewat server + WorldValidator.
- `apps/web` = developer bridge, BUKAN game. Jangan taruh game loop di web.
- Engine (code-intelligence) PISAH dari game MMO — game pakai engine sebagai input.
- Self-host per shard (D-009): tiap region/server punya host sendiri; relay cuma
  registry/bridge, bukan server game.
- Repo = 1 vessel (D-007). `connectRepository` (universe) jadi pintu masuk.
- Konvensi file: header Apache 2.0 8 baris + barrel `index.ts` + komentar fungsi
  di atas deklarasi. Gak ada package.json/tsconfig per package (flat monorepo,
  root tsconfig `moduleResolution: bundler`).
- `docs/` gitignored — semua file docs/blueprint/** di-add dengan `git add -f`.

---

## 5. Log sesi (isi tiap sesi — biar gak lupa & gak tumpang tindih)

| Tanggal | PR / commit | Yang dikerjakan | Status |
|---|---|---|---|
| 2026-08-28 | #580 | universe World Model foundation | ✅ merged |
| 2026-08-28 | #582 | gameserver core (world/validator/sim/combat) | ✅ merged |
| 2026-08-28 | — | scaffolding relay + apps/game + kerangka gate/netcode/persistence | in progress |
| 2026-08-28 | — | blueprint V4 (07), V5 HUD (01 §20), V6 persistent (08) + D-013/D-014 + respawn-open | in progress |
| 2026-08-28 | — | blueprint cosmic: 01 §2 living environment + fase lunar + 3 lapis body; 03 I.9 collision damage; 04 source wreckage; arsitektur environs/collision/cosmic-event | in progress |
