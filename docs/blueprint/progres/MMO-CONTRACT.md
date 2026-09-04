# ARCLUX MMO — FILE CONTRACT (wajib dibaca sebelum tambah/sentuh file)

> **Ini kontrak lokasi + arah wiring.** Setiap file baru di `apps/game`,
> `packages/gameserver`, `packages/universe`, `packages/relay` WAJIB punya
> kontrak (di-import dari mana, barrel apa, diverifikasi bagaimana).
> File tanpa kontrak = file yatim = PR ditolak.
>
> Pendamping: `MMO-IMPLEMENTATION.md` (status apa yang sudah jadi),
> `decisions-mmo.md` (kenapa begitu), blueprint `01-10` (desain).
> Verifikasi kontrak pakai MCP ARCLUX (`dependency_graph`, `file_info`,
> `impact`, `detect`), scope **repo-root** — jangan scope per-folder
> (false positive orphan, terbukti sesi audit 09-04).

---

## 1. Lisensi header (jangan campur)

| Area | Header | Contoh |
|---|---|---|
| `apps/game`, `packages/gameserver`, `packages/universe`, `packages/relay`, `packages/directory` | ARCLUX MMO License v1 (6 baris `Copyright 2026 GSF-001` + `LICENSE-MMO`) | `packages/gameserver/index.ts:1-6` |
| `apps/cli`, `packages/engine`, engine lain | Apache-2.0 (`LICENSE-ENGINE`) | `apps/cli/serve.ts:1-8` |

File MMO baru tanpa header MMO = pelanggaran kontrak.

## 2. Monorepo flat (jangan bikin package baru sembarangan)

- **Tidak ada `package.json`/`tsconfig.json` per package** di
  `packages/gameserver`, `packages/universe`, `packages/relay`
  (terverifikasi: file tidak ada). Yang punya `package.json` cuma
  `apps/*` (`apps/game/package.json` = `arclux-game`, deps `three`,
  build via `scripts/build-game.mjs`).
- Root `tsconfig` `moduleResolution: bundler`. Import antar-package
  pakai **relative path** (`../universe/types`, `../../../../packages/...`),
  bukan workspace alias.
- Komentar fungsi di atas deklarasi. Satu file = satu concern.

## 3. Barrel rule (file baru wajib terdaftar)

Setiap file `.ts` baru WAJIB di-re-export dari barrel foldernya:

| Folder | Barrel | Status |
|---|---|---|
| `packages/gameserver/*.ts` | `packages/gameserver/index.ts` (`export *`, 31 modul) | wajib |
| `packages/gameserver/transport/*.ts` | `packages/gameserver/transport/index.ts` + re-export via `netcode.ts` (backward compat) | wajib |
| `packages/universe/*.ts` | `packages/universe/index.ts` (types/stats/license/schema/connect) | wajib |
| `packages/relay/*.ts` | `packages/relay/index.ts` (types/registry/gate/identity) | wajib |
| `apps/game/src/renderer/scene3d/*.ts` | `apps/game/src/renderer/scene3d/index.ts` | wajib (catatan: `rng.ts` + `orbital.ts` hasil split belum masuk barrel — temuan audit 09-04, bereskan) |

Cek otomatis: `node scripts/check-mmo.mjs` (warning kalau file gameserver
tidak tercatat di checklist `MMO-IMPLEMENTATION.md` §3).

## 4. Kontrak per area — file baru HARUS mengarah ke sini

### 4.1 `packages/gameserver` (server authoritative, D-008)

```
types.ts          = KONTRAK BERSAMA (Vec3, GameEntity, VesselEntity,
                    StationEntity, RegionState/Snapshot, GameEvent,
                    PlayerIntent). Di-import 27 file (server + 5 renderer
                    game). Tambah field entity/snapshot/intent = ubah sini.
                    Type-only import dari consumer, jangan logic di sini.
world.ts          = WorldRegion: registry entity (spawn/move/remove vessel
                    & station), snapshot, regionFromState, distanceBetween,
                    safe-zone data. State baru per-region = sini.
server.ts         = createGameServer() (satu-satunya launcher, dipakai
                    apps/cli/serve.ts + apps/game/index.ts). Route HTTP:
                    /snapshot /health /intent /deliver. Opsi/route baru = sini.
simulation.ts     = SimulationEngine.tick: SATU-SATUNYA tempat intent
                    dieksekusi (validateIntent → combat/collision/thermics/
                    capability/governance → move). Sistem sim baru WAJIB
                    dipanggil dari tick sini, bukan jalan sendiri.
validator.ts      = validateIntent (identity/owner/range/cooldown/safe-zone
                    + universe/license checkComponent). Aturan tolak/terima
                    baru = sini. Hasil: ACCEPT|REJECT, tidak ada setengah.
combat.ts         = applyCombatIntent + DAMAGE_CEILING + SUBSYSTEM_DESTROYED_AT.
                    Damage baru = sini (satu pipa, tidak ada damage jalur lain).
physics.ts        = clampSpeed + gerak. environs.ts = orbit/benda langit
                    (D-016/D-020). collision.ts = tabrakan → damage (D-017).
                    thermics.ts = radiasi/termal. cosmicEvent.ts = event acak.
capability.ts     = aktivasi capability (V4, 3x → depleted) + component.ts
                    (binding) + lineage.ts (provenance tech) + cockpit.ts
                    (registry HUD). Semua lewat validator 11 cek.
teleport.ts       = 2-teleport + cooldown (D-022). intel.ts = sharing
                    kordinat (D-021). governance.ts = safe-zone/paused guard.
                    baseline.ts = Universal Baseline check (D-019).
persistence.ts    = validateRegion + InMemory/DbPersistence (collection
                    "regions" + "handoffs" via packages/db + RecoveryManager).
                    State persisten baru = sini (D-013).
gate.ts           = GateLink + createGateRouter.transit (radius + community
                    auth). bridge.ts = gate → relay handoff lintas shard.
                    regionState.ts / stability.ts / observability.ts /
                    rateLimiter.ts = sesuai nama, panggil dari simulation.
transport/        = kontrak Transport.ts. Transport baru WAJIB implement
                    kontrak itu + daftar di transport/index.ts + netcode.ts.
```

### 4.2 `packages/universe` (World Model — SRC vessel, PR #580)

```
types.ts  = VesselModel/SystemState/ComponentBinding/ArcluxManifest (owned
            di sini; gameserver hanya type-import, JANGAN duplikat type).
stats.ts  = deriveBaseStats/mergeManifest/buildVesselModel (satu-satunya
            jalan repo → vessel). Field stat baru = sini.
schema.ts = validateManifest/capOverride. license.ts = checkComponent/
            validateVesselComponents (3-tier open/shared/private).
connect.ts= connectRepository (boilerplate .arclux/).
```

**Perubahan di sini menyebar ke gameserver — review dulu** (MMO-IMPLEMENTATION §2.1).

### 4.3 `packages/relay` + `packages/directory` (bukan game server)

```
relay/registry.ts = claim region → server (cek shard ter-register dulu).
relay/gate.ts     = createGateCoordinator.requestHandoff (token anti-clone,
                    idempotency seq) + deliver hook.
relay/identity.ts = presence lintas shard + move() saat handoff.
directory/        = DIRECTORY ≠ AUTHORITY: registerServer/heartbeat/
                    listServers saja. Tidak boleh sim/validasi di sini.
```

### 4.4 `apps/game` (client render saja, D-008)

```
index.ts → main.ts (startMain, Electron 1280×800, load dist/renderer atau
           fallback :24001) + gameserver/server.ts (createGameServer).
renderer/renderer.ts = BOOTSTRAP: initScene3D + initHud + connectNet +
           initInput + initAudio + initMenu + initLanding. Modul renderer
           baru WAJIB di-wire dari sini.
renderer/net.ts  = connectNet(): directory listServers(ONLINE) → env
           ARCLUX_GAME_PORT → fallback 127.0.0.1:24001; poll snapshot
           100ms; POST /intent. SATU-SATUNYA jalan client → server.
renderer/scene3d/ = VISUAL-ONLY (planet/moon/belt/vessel/Ark/clouds/
           explosion). Dilarang memutuskan posisi/damage/health di sini.
           FPS ≠ reality.
renderer/input.ts / audio.ts / hud.ts / menu.ts / landing.ts / settings.ts
           = sesuai nama; bahasa visual dari ui/tokens.ts (D-025, bukan
           tailwind web). ThreatCrush: 0 innerHTML (textContent + esc).
```

### 4.5 `apps/cli` (pintu masuk operator)

Command baru WAJIB `register*Command` + daftar di `apps/cli/index.ts`.
Pola baku: `connect` (connectRepository → analyzeRepository →
buildVesselModel) dan `serve` (createGameServer → start → optional
`--vessel`: analyzeRepository + buildVesselModel + spawnPlayerVessel).

## 5. Invariant (tidak bisa ditawar, D-001..D-025)

1. Client TIDAK pernah otoritas (I-1). Semua kebenaran dari server + validator.
2. `apps/web` = developer bridge, BUKAN game. Tidak ada game loop di web.
3. Engine code-intelligence PISAH dari MMO — game pakai engine sebagai input.
4. Self-host per shard (D-009); relay/directory cuma registry/bridge.
5. 1 repo = 1 vessel (D-007); pintu masuk = `connectRepository`.
6. Restart ≠ reset (D-013); no player-initiated pause (D-014).

## 6. Checklist verifikasi tiap PR (09/10 dan seterusnya)

```
[ ] node scripts/build-game.mjs — bundle sukses
[ ] npx tsc --noEmit -p apps/game/tsconfig.json — bersih
[ ] npx tsc --noEmit -p packages/gameserver/tsconfig.json — bersih
[ ] grep -rn "innerHTML.*+" apps/game/src/renderer/ — 0 match
[ ] arclux_detect orphan_files scope REPO-ROOT — 0 file yatim baru
      (abaikan temuan scope per-folder: server.ts/bridge.ts/transport
       ter-wire lintas-package, terbukti via file_info)
[ ] node scripts/check-mmo.mjs — OK (atau update checklist §3)
[ ] MMO-IMPLEMENTATION.md §2 + §3 di-update (file + PR)
[ ] docs/ di-add pakai git add -f (docs/ gitignored)
[ ] Manual test: serve --vessel → landing → cockpit (lihat QUICKSTART-MMO.md)
```

## 7. Anti-pattern (langsung tolak)

- File `.ts` baru tanpa importer (tidak di barrel, tidak di entry) — file yatim.
- Type duplikat (VesselModel/PlayerIntent di-copy ke file baru, bukan import).
- Logika sim/validasi di `apps/game` atau `apps/web`.
- Transport/gate/persistence paralel yang bypass `simulation.ts` / `bridge.ts`.
- `package.json`/`tsconfig` baru per package.
- Header lisensi salah area (§1). Docs baru tanpa `git add -f`.
