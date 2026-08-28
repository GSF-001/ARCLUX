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
SECTOR A (server 1)                SECTOR B (server 2)
┌───────────────────┐    GATE    ┌───────────────────┐
│ 🚀   🛰  planet     │  ═══ ORG  │  🛰     🚀  planet │
└───────────────────┘            └───────────────────┘
   (shard A owned)                   (shard B owned)
```

- Universe logis dibagi region/sistem. Tiap shard server menangani satu set
  region.
- Jump gate menghubungkan antar region (handoff vessel antar server).
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
3. **`packages/relay`** — shard registry + gate handoff + identity lintas shard
4. **`apps/game`** (Electron) — client 3D + net integration + UI universe
5. **Integrasi penuh** — `arclux connect` → vessel masuk universe, jump gate
   antar region, station/community layer

---

## Batas arsitektur

- `apps/web` = developer bridge, BUKAN game.
- Engine ARCLUX (code-intelligence) PISAH dari game MMO — game memakai engine
  sebagai input, bukan jadi bagiannya.
- Semua keputusan sensitif (combat/ownership) lewat server authoritative +
  World Validator; client cuma render.
