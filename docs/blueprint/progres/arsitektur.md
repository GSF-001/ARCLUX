# ARCLUX MMO Universe — Arsitektur

Peta arsitektur produk game ARCLUX (server authoritative + client Electron +
shard registry). Berdasarkan keputusan di [decisions-mmo.md](decisions-mmo.md).

---

## Komponen inti

```
┌────────────────────────────────────────────────────────────────┐
│                      ARCLUX PLATFORM                            │
├────────────────────────────────────────────────────────────────┤
│  apps/web          → developer bridge (health/impact/provenance)│
│  apps/cli          → arclux connect / analysis (engine)         │
│  packages/universe → World Model core (VesselModel, License) ✅ │
├────────────────────────────────────────────────────────────────┤
│  apps/game (Electron)     → GAME CLIENT (3D universe + input)   │
│  packages/gameserver      → AUTHORITATIVE MMORPG SERVER         │
│    ├── World/Region model (shard = region)                      │
│    ├── Simulation loop + World Validator (Layer I)              │
│    ├── Jump Gate routing antar region                           │
│    └── Persistence per region (packages/db + RecoveryManager)   │
│  packages/relay           → SHARD REGISTRY + BRIDGE             │
│    (pusat: claim region, list server, gate handoff, identity)   │
└────────────────────────────────────────────────────────────────┘
```

---

## Model shard: Region + Gates

```
SECTOR A (server 1, system bintang A)   SECTOR B (server 2, system bintang B)
┌───────────────────┐    GATE    ┌───────────────────┐
│ ☉🪐🌙☄️ 🚀  🛰     │  ═══ ORG  │  ☉🪐 ☄️   🛰 🚀    │
└───────────────────┘            └───────────────────┘
   (shard A owned)                   (shard B owned)
```

- Universe logis dibagi **region = sistem bintang**. Tiap shard server menangani
  satu set region.
- Setiap region membawa **`SystemBodies[]`** (star, planet, moon, asteroid,
  backdrop) dengan orbit deterministik (lihat
  [01-spatial-ux.md](../../blueprint/01-spatial-ux.md) §2.3).
- Jump gate menghubungkan antar region (handoff vessel antar server) = pindah
  sistem bintang.
- Tiap fleet/komunitas claim region & host server region-nya.

---

## Alur data (authoritative)

```
CLIENT (Electron)
   │  input intent (move/attack/action)
   ▼
GAME SERVER (authoritative)
   ├── World Validator  (validasi request: license/state/range/etc)
   ├── Simulation       (posisi/damage/fisik — rule engine)
   ├── Event log / replay
   └── Persistence      (per region, packages/db)
   ▼
   DAMAGE/STATE EVENT ──▶ CLIENT A render + CLIENT B render
```

Client TIDAK pernah menjadi otoritas — ia render hasil validated simulation.

---

## Reuse inventaris (sudah ada)

| Aset | Untuk |
|---|---|
| `packages/universe` | VesselModel, SystemState, LicenseValidator, stat mapping (PR #580) |
| `packages/engine/pipeline.ts` | analisis repo → vessel base stats |
| `packages/db` + RecoveryManager | persistensi world/region/vessel state |
| `packages/daemon` + `watcher` | auto-update vessel saat repo berubah |
| `packages/provenance` | history vessel/component/ownership |
| `three` + `GraphCanvas3D` | fondasi render 3D vessel |
| `packages/shell/plugins.ts` + `detectors.ts` | extension user-space |

---

## Build plan (urutan, tiap item = PR terpisah, jangan auto-merge)

1. **PR #580** — `packages/universe` fondasi World Model ✅ (sudah merged)
2. **`packages/gameserver`** — server authoritative + WorldModel + Validator
   (region single dulu), sim loop, netcode input-queue, replay
   - core (world/validator/sim/combat) ✅ PR #582
   - kerangka tambahan (gate/netcode/persistence) ✅ scaffold
   - **cosmic environment** — `environs.ts` (orbit integrator deterministik per
     tick) + `collision.ts` (tabrakan vs benda COLLIDABLE → damage, reuse I.2/I.7)
     + `cosmic-event.ts` (solar wind/CME/meteor acak) — desain 01 §2.6 / 03 I.9
     + `thermics.ts` (radiasi termal ∝1/r² → suhu → material limit/melt; 01 §2.6)
   - **universal baseline** — baseline ARCLUX wajib per repo (imun gravitasi,
     identitas, sistem dasar) — desain 05 §7.1 / D-019
   - **intel & mobilisasi** — koordinat/waypoint ber-label + aliansi + 2-teleport
     (portal, cooldown) — desain 06 §18.6-18.8 / D-021-022
2. **`packages/relay`** — shard registry + gate handoff + identity lintas shard
   - scaffold ✅ (registry/gate/identity)
3. **`apps/game`** (Electron) — client 3D + net integration + UI universe
   - scaffold ✅ (main/renderer + build script)
   - **UI command-interface** EVE-level + HUD identitas sosial (01 §20/§28)
4. **Integrasi penuh** — `arclux connect` → vessel masuk universe, jump gate
   antar region, station/community layer

> **IMPL.** Urutan kerja & status tiap modul yang hidup di
> [MMO-IMPLEMENTATION.md](MMO-IMPLEMENTATION.md) — baca itu dulu sebelum ngoding.

---

## Batas arsitektur

- `apps/web` = developer bridge, BUKAN game.
- Engine ARCLUX (code-intelligence) PISAH dari game MMO — game memakai engine
  sebagai input, bukan jadi bagiannya.
- Semua keputusan sensitif (combat/ownership) lewat server authoritative +
  World Validator; client cuma render.
