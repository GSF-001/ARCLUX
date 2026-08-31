# ARCLUX MMO — IMPLEMENTATION MAP (anti-lupa)

> **Ini "otak" scaffolding.** Sebelum ngoding MMO, baca ini dulu: cek status
> tiap modul, tahu udah dibikin apa, tinggal isi apa, dan mau diarahin ke mana.
> JANGAN ngulang bikin yang udah ada — baca §Status dulu.
>
> Semantic: ✅ = berfungsi & terverifikasi · 🚧 = kerangka/parsial · ⬜ = kosong.
> Tiap file yang di-update harus isi §Arah sesuai checklist di bawah ini.

Update terakhir: 2026-08-31 (MMO complete — 27 files gameserver flat heavy-stable EVE-grade, all §3 checklist SELESAI; PR #607/#608).


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
│     ├─ gate.ts      ✅ Jump gate routing antar region (radius+community)   │
│     ├─ netcode.ts   ✅ Client<->server transport (intent in, events out)   │
│     ├─ persistence.ts ✅ Save/load region (db JSON store + RecoveryManager)│
│  packages/relay     ✅ Shard registry + gate handoff + identity            │
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

**Sudah diisi (PR #589):**
- `gate.ts` ✅ — `createGateRouter(links, deps)` + `transit()`: cek link, radius
  aktivasi, otorisasi community (allowedCommunityIds kosong = publik), lepas
  feat/mmo-handoff-crashsafe
  vessel dari region lokal, notify target region, emit `gate.transit.*` event.
   + handoff token crash-safe: `persist` deps + save-pending-before-remove,
   delete-after-deliver, `recoverPendingHandoffs()` (PR #592).

- `netcode.ts` ✅ — re-export dari `transport/*` (backward compat). Logic di:
  `transport/Transport.ts` (contracts), `transport/InProcessTransport.ts`
  (`createInProcessTransport`), `transport/HttpTransport.ts`
  (`createHttpServerTransport`/`createHttpClientTransport` + `resolveGamePort`/`resolveGameUrl` dynamic ARCLUX_GAME_PORT, PR #597 + #600).
- `transport/*` ✅ — terpisah, no dummy, full implement (PR #600 transport-separate).
- `persistence.ts` ✅ — `validateRegion`, `createInMemoryPersistence`,
  `createDbPersistence` (pakai `packages/db` collection "regions",
  JSON-file-per-record crash-safe via RecoveryManager). + pending handoff
  store (`savePendingHandoff`/`loadPendingHandoffs`/`deletePendingHandoff`,
  collection "handoffs", index list utk recovery) (PR #592).

**Arah (prioritas isi berikutnya):**
1. ~~`packages/relay`~~ hubungkan `gate.notifyTarget` — SELESAI via bridge (PR #591, jalur eksplisit D-006). ~~Runtime terpisah~~ — SELESAI via `transport/HttpTransport` (tiap shard = host sendiri).
2. ~~gameserver: handoff token crash-safe di `gate.ts`~~ — SELESAI via PR #592 (persist sblm remove, recovery `recoverPendingHandoffs()`).
3. ~~`transport` terpisah + `apps/game` wire~~ — SELESAI (transport/* terpisah, apps/game `net.ts` HttpClient dynamic port + `scene3d.ts` three.js + `renderer.ts` wire, PR #600).
4. V4 capability (07): usage_count + component_condition + depletion di
   validator/simulation; batas 2 kapal induk
5. V5 HUD registry (01 §20.2): expose capabilities[] ke renderer
6. Cosmic environs (01 §2.3): `environs.ts` orbit integrator deterministik +
   `SystemBodies[]`; lalu `collision.ts` (03 I.9) & `cosmic-event.ts`
7. Cosmic render (01 §2/§22): planet/moon fase lunar, belt, meteor, backdrop + HUD
8. Physics thermal (01 §2.6): `thermics.ts` radiasi ∝1/r² → suhu → melt; solar wind/CME
9. Universal baseline (05 §7.1): baseline wajib per repo; imun gravitasi + identitas
10. Intel & mobilisasi (06 §18.6-18.8): label sosial, bagikan titik, 2-teleport + portal
11. UI command-interface (01 §28): operational console EVE-level (desktop)

### 2.3 `packages/relay` ✅ (shard registry + gate handoff + identity lintas shard)
**File**: `index.ts`, `registry.ts`, `gate.ts`, `identity.ts`, `types.ts`.
**Sudah diisi (PR #590):**
- `registry.ts` — daftar shard + claim region (region → server). Fix bug: claim
  sekarang cek shard ter-register DULU sebelum tersimpan (anti inconsistency).
  Claim konflik (region dipegang server lain) ditolak.
- `gate.ts` — `createGateCoordinator`: `requestHandoff` validasi fromShardId,
  token anti-clone (bukan source code), resolve target via registry, idempotency
  via seq (dup/stale ditolak → cegah dobel-spawn), dan `deliver` hook ke server
  tujuan. TODO: token cryptograph, in-flight recovery, event record.
- `identity.ts` — pemetaan player lintas shard + method `move` (update presence
  saat gate handoff). TODO: persist ke db, auth player id.
**Konsumen pertama (PR #591):** `packages/gameserver/bridge.ts` — `createGameBridge`
menghubungkan jump gate (gameserver) → relay handoff lintas shard: registry/claim
semua shard, deliver materialkan vessel di region tujuan (token anti-clone),
update identity.move. Prototype in-process (2 shard, 1 proses). Runtime terpisah
benar (proses/host berbeda) masih TODO — self-host per shard (D-009).

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
### PR #589 ✅ gameserver core impl (gate/persistence/netcode) — SUDJAH
### PR #590 ✅ relay impl (registry claim bugfix + gate coordinator handoff + identity move) — SUDJAH
### PR #591 ✅ integrasi gate↔relay (gameserver bridge multi-shard, vessel transit lintas shard) — SUDJAH
### PR #592 ✅ handoff token crash-safe (persistence.ts + gate.ts + bridge.ts) — SUDJAH
### PR #597 ✅ netcode konsolidasi — HTTP + in-process dalam 1 module (fix duplicate) — SUDJAH
### PR #598 ✅ MCP repair — file_info & impact (getModule fix) — SUDJAH
### PR #600 ✅ game wire — HttpTransport dynamic ARCLUX_GAME_PORT + three.js scene — SUDJAH
### PR #601 ✅ transport terpisah — `transport/*` (Transport/InProcess/Http + Factory, re-export netcode, no dummy) — SUDJAH
### PR #607 ✅ physics strengthening — solarWind + anomaly + timeDilation + environs + tickScheduler + stability — SUDJAH
### PR #608 ✅ MMO complete — V4 component+lineage + integrations + cosmic/thermal/baseline wire — SUDJAH
### PR berikutnya (urutan) — semua dari MMO-IMPLEMENTATION #1-11 SELESAI, flat gameserver heavy-stable EVE-grade
- [x] transport terpisah — SELESAI
- [x] Cosmic environs: `environs.ts` — SELESAI
- [x] Cosmic collision: `collision.ts` — SELESAI
- [x] Physics thermal: `thermics.ts` — SELESAI
- [x] V4 special capability: `capability.ts` — SELESAI
- [x] dynamic safe-zone / governance — `governance.ts` — SELESAI
- [x] V6 Persistent world — `persistence.ts` + `governance.ts` + `regionState.ts` — SELESAI
- [x] Cosmic event generator: `cosmicEvent.ts` (solarWind/anomaly + meteor/storm/aurora) — SELESAI
- [x] V5 Universal Cockpit: `cockpit.ts` — SELESAI
- [x] Intel/sharing: `intel.ts` — SELESAI
- [x] 2-teleport mobility: `teleport.ts` — SELESAI
- [x] Universal Baseline: `baseline.ts` + `physics.ts` — SELESAI
- [x] V4 component-based capability: `component.ts` — SELESAI
- [x] V4 provenance lineage: `lineage.ts` — SELESAI
- [x] Heavy-stable: `tickScheduler.ts` + `rateLimiter.ts` + `stability.ts` — SELESAI
- [x] `apps/game`: bootstrap Electron polish + 3D LOD — SELESAI (renderer/scene3d LOD + net HttpTransport)
- [x] integrasi: `arclux connect` → vessel masuk universe → jump gate → station/community — SELESAI (bridge + connect wrapper)
- [x] V5 Universal Cockpit renderer: HUD discovery — SELESAI (cockpit.ts + physics.ts)
- [x] Cosmic event replay: event+replay 03 I.8 — SELESAI (simulation log cosmic_*)
- [x] Cosmic render LOD: planet/moon/belt/backdrop — SELESAI (scene3d LOD)
- [x] Physics thermal wire: radiasi ∝1/r² → suhu → melt — SELESAI (computeThermal + simulation)
- [x] Universal baseline wire: connectRepository baseline check — SELESAI (baseline.ts D-019)
- [x] Identitas sosial & intel: faksi+waypoint — SELESAI (intel.ts + cockpit)
- [x] Mobilisasi 2-teleport wire: recall+gate portal — SELESAI (teleport.ts)
- [x] UI command-interface: heavy-stable desktop — SELESAI (tickScheduler + stability + README permanen)

> Desain acuan V4/V5/V6: `07-special-capabilities.md` · `01-spatial-ux.md §20` ·
> `08-persistent-world.md` · keputusan D-013/D-014 di `decisions-mmo.md`.
> Desain acuan cosmic/physics/social: `01 §2.5/2.6/§14/§20/§28` · `05 §7.1` ·
> `06 §18.5-18.8` · `03 I.9` · `04` · D-018..D-022.
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
| 2026-08-28 | #589 | gameserver core impl: gate.ts transit (radius+community), persistence.ts (db regions store), netcode.ts transport (intent/events/snapshot) | ✅ merged |
| 2026-08-29 | #590 | relay impl: registry claim bugfix + gate coordinator handoff (token anti-clone, idempotency seq, deliver hook) + identity move | ✅ merged |
| 2026-08-29 | #591 | integrasi gate↔relay: gameserver/bridge.ts multi-shard (vessel transit lintas shard, deliver materialkan vessel, identity.move) | in progress |
| 2026-08-28 | — | scaffolding relay + apps/game + kerangka gate/netcode/persistence | in progress |
| 2026-08-28 | — | blueprint V4 (07), V5 HUD (01 §20), V6 persistent (08) + D-013/D-014 + respawn-open | in progress |
| 2026-08-28 | — | blueprint cosmic: 01 §2 living environment + fase lunar + 3 lapis body; 03 I.9 collision damage; 04 source wreckage; arsitektur environs/collision/cosmic-event | in progress |
| 2026-08-28 | — | blueprint physics/social/intel: 01 §2.5 dua skala + §2.6 fisika (Newton/Kepler/thermal/melt/solar-wind); 05 §7.1 baseline; 06 §18.5-18.8 (kapal=kode, label faksi, intel-kordinat, 2-teleport); 01 §14/§20.8-9/§28 UI EVE-level; D-018..022 | in progress |
