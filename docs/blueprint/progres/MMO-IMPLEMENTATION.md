# ARCLUX MMO — IMPLEMENTATION MAP (anti-lupa)

> **Ini "otak" scaffolding.** Sebelum ngoding MMO, baca ini dulu: cek status
> tiap modul, tahu udah dibikin apa, tinggal isi apa, dan mau diarahin ke mana.
> JANGAN ngulang bikin yang udah ada — baca §Status dulu.
>
> Semantic: ✅ = berfungsi & terverifikasi · 🚧 = kerangka/parsial · ⬜ = kosong.
> Tiap file yang di-update harus isi §Arah sesuai checklist di bawah ini.

Update terakhir: 2026-09-03 (MMO live — 31 files gameserver + 09 client polish Fase 1-5 done + clouds AAA + landing MMO CCTV + quickstart EN + serve --vessel wire; PR #630-#639).


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
│  packages/gameserver ✅ Authoritative server (31 files, EVE-grade)         │
│     ├─ gate.ts      ✅ Jump gate routing antar region (radius+community)   │
│     ├─ netcode.ts   ✅ Client<->server transport (intent in, events out)   │
│     ├─ persistence.ts ✅ Save/load region (db JSON store + RecoveryManager)│
│     └─ server.ts    ✅ Self-host launcher + serve --vessel auto-spawn      │
│  packages/relay     ✅ Shard registry + gate handoff + identity            │
│  apps/game          ✅ Electron client (landing CCTV + 3D + input + net)   │
│     ├─ scene3d.ts   ✅ Cosmic + Ark stadium + clouds + explosions + env map│
│     ├─ landing.ts   ✅ MMO landing AAA+ (live CCTV bg + glass + stats)    │
│     ├─ audio.ts     ✅ 5 SFX + ambient + music                             │
│  docs/blueprint/09  ✅ Client polish Part A (7 fase) + Part B (5 fase)     │
│  QUICKSTART-MMO.md  ✅ English quickstart from zero                        │
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

**Arah (prioritas isi berikutnya) — update 09-03:**
1. ~~`packages/relay`~~ hubungkan `gate.notifyTarget` — SELESAI via bridge (PR #591).
2. ~~handoff token crash-safe di `gate.ts`~~ — SELESAI via PR #592.
3. ~~`transport` terpisah + `apps/game` wire~~ — SELESAI via PR #600.
4. ~~V4 capability~~ — SELESAI `capability.ts` (PR #608).
5. ~~V5 HUD registry~~ — SELESAI `cockpit.ts` (PR #608).
6. ~~Cosmic environs~~ — SELESAI `environs.ts` + `collision.ts` + `cosmicEvent.ts` (PR #607/608).
7. ~~Cosmic render~~ — SELESAI `scene3d.ts` planet/moon/belt/backdrop (PR #608) + **clouds AAA+ di SEMUA planet** `makeCloudTexture` (PR #639, visual-only, gak nabrak `WorldRegion`/`Environs`).
8. ~~Physics thermal~~ — SELESAI `thermics.ts` (PR #608).
9. ~~Universal baseline~~ — SELESAI `baseline.ts` + `connect.ts` `arclux connect` (PR #580) + **`serve --vessel` auto-spawn** `serve.ts:36` `apps/cli/serve.ts` → `analyzeRepository` + `buildVesselModel` → `spawnPlayerVessel` (PR #633, tanpa nebak).
10. ~~Intel & mobilisasi~~ — SELESAI `intel.ts` + `teleport.ts` (PR #608).
11. ~~UI command-interface~~ — SELESAI `tickScheduler` + `hud.ts` EVE-level (PR #608) + **landing MMO AAA+** `landing.ts` live CCTV `scene3d` bg + glass + live stats `directory` (PR #635).
12. **09 Client Polish Part A** — Fase 1 env map PMREM `scene.environment` tiap 10 frame (PR #630) + Fase 2 vessel AAA+ fuselage+canopy+delta wings+nacelles (PR #630) + Fase 3 Ark stadium 12 komponen 4 ring InstancedMesh (PR #631) + Fase 4 explosion 5 burst+12 debris+30 sparks+flash (PR #632) + Fase 5 5 SFX `audio.ts` (PR #638) + **Fase 6 custom music** MP3/OGG/WAV/FLAC decode + playlist + AUDIO tab `audio.ts` + `menu.ts` (PR #642) + **Fase 7 UI polish** `hud.ts` (fadeOnChange/hash-guard, target glow pulse, scanline drift, hierarchy, gradient edges) + `menu.ts` (wireHover/wireSliderGlow, tab fade, slide-in 0.3s) (PR #649) — **Fase 1-7 DONE (Fase 6 selesai PR #642, doc sync 09-04), Part B 8-12 next**.
13. **Quickstart EN** — `QUICKSTART-MMO.md` English from zero (clone → vessel → serve --vessel → landing) (PR #636).

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

### 2.4 `apps/game` ✅ (Electron client 3D — live)
**Sudah ada (PR #608 + #630-#639):**
- `src/main/main.ts` + `index.ts` — Electron 1280×800, `staticDir` `dist/renderer`, fallback `http://127.0.0.1:24001`
- `src/renderer/scene3d.ts` — cosmic heavy-stable: starfield 6160 Instanced, nebula 9 sprites, suns 1-3 Directional, planets 9 Sphere 48 + atmo Sprite + ring + moons Kepler + fase lunar `emissiveIntensity`, belt 6000 Instanced Dodecahedron, backdrops 6, meteors 60 Lines + aurora 2 Sprites, **env map PMREM** `scene.environment` tiap 10 frame (Fase 1), **vessel AAA+** fuselage+canopy+delta wings+nacelles (Fase 2), **Ark stadium 12 komponen** 4 ring habitat/docking/platform/windows InstancedMesh + animasi (Fase 3), **explosions** 5 burst+12 debris+30 sparks+flash 2s (Fase 4), **clouds AAA+** `makeCloudTexture` 512 per-kind `Sphere 1.018` child drift (PR #639, di SEMUA planet, visual-only, 1 draw/planet, 1 MB/tex, dispose `buildPlanetSystem` + `dispose()`)
- `src/renderer/renderer.ts` — bootstrap `initScene3D` + `initHud` + `connectNet` + `initInput` + `initAudio` + `initMenu` + `initLanding` (Fase 5 wire `setSfxHandler` + ambient hum), `toRegionState` adapter, `landing` live CCTV + glass
- `src/renderer/landing.ts` — **MMO landing AAA+** (PR #635) live CCTV bg (scene3d canvas), glass `rgba(12,16,32,0.62)` + thin border + orange accent `tactical` + HUD type `Orbitron/JetBrains Mono`, top navbar HOME…LAUNCH GAME, hero PLAY NOW, live stats bar `net.fetchSnapshot()` 4s (players/regions/factions/destroyed), 3 feature cards + news panel, footer — semua interaktif, bukan tempelan, logo `public/arclux-logo.svg|.png`
- `src/renderer/audio.ts` — **5 SFX** `sfxExplosion` lowpass 2000→100 0.8s, `sfxWeapon` square 800→200 0.15s, `sfxShieldHit` triangle+bandpass 0.3s, `sfxDebris` 3× noise bursts, `sfxAmbientHum` saw 38 Hz → `musicGain` continuous (PR #638), sfxGain vs musicGain terpisah, bus master
- `src/renderer/input.ts` — WASD/QE + boost/brake + pointer-lock look + `onWeapon` KeyF/J / mousedown → `attack` intent + `sfxWeapon`
- `src/renderer/settings.ts` + `ui/tokens.ts` — D-025 palette, `GameSettings` presets LOW..CINEMATIC, `effPixelRatio`
- `src/renderer/index.html` — CSP `default-src 'self'`, `#app` 100vw/vh
- `public/arclux-logo.svg` — placeholder, upload `arclux-logo.svg|png` langsung muncul di landing

**Arah next:** Part B 8-12 interior FPS + karakter + hangar + bazaar + stadium bebas (`09-client-polish.md` Part B).

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
### PR #591 ✅ integrasi gate↔relay (gameserver bridge multi-shard) — SUDJAH
### PR #592 ✅ handoff token crash-safe — SUDJAH
### PR #597 ✅ netcode konsolidasi — SUDJAH
### PR #598 ✅ MCP repair — SUDJAH
### PR #600 ✅ game wire — SUDJAH
### PR #601 ✅ transport terpisah — SUDJAH
### PR #607 ✅ physics strengthening — SUDJAH
### PR #608 ✅ MMO complete — SUDJAH
### PR #622-624 ✅ UHD + self-host — SUDJAH
### PR #625 ✅ blueprint §2 cosmic client — SUDJAH
### PR #626-628 ✅ 09 Part A+B doc — SUDJAH
### PR #630 ✅ 09 Fase 1+2 — env map PMREM + vessel AAA+ (scene3d.ts) — SUDJAH (2026-09-02)
### PR #631 ✅ 09 Fase 3 — Ark stadium 12 komponen 4 ring InstancedMesh (scene3d.ts) — SUDJAH (2026-09-02)
### PR #632 ✅ 09 Fase 4 — explosion 5 burst+12 debris+30 sparks+flash (scene3d.ts) — SUDJAH (2026-09-02)
### PR #633 ✅ fix serve --vessel auto-spawn wire — SUDJAH (2026-09-02, apps/cli/serve.ts:36)
### PR #635 ✅ landing MMO AAA+ — live CCTV scene3d bg + glass + live stats (landing.ts) — SUDJAH (2026-09-03)
### PR #636 ✅ quickstart MMO EN — SUDJAH (QUICKSTART-MMO.md)
### PR #638 ✅ 09 Fase 5 — 5 SFX explosion/weapon/shield/debris/ambient hum (audio.ts) — SUDJAH (2026-09-03)
### PR #639 ✅ clouds AAA+ — procedural clouds di SEMUA planet visual-only (scene3d.ts makeCloudTexture) — SUDJAH (2026-09-03, pause 09 di Fase 5)
### PR berikutnya (urutan) — 09 Part A sisa + Part B (09-client-polish.md 12 fase)
- [x] transport terpisah — SELESAI
- [x] Cosmic environs — SELESAI
- [x] Cosmic collision — SELESAI
- [x] Physics thermal — SELESAI
- [x] V4 special capability — SELESAI
- [x] dynamic safe-zone / governance — SELESAI
- [x] V6 Persistent world — SELESAI
- [x] Cosmic event generator — SELESAI
- [x] V5 Universal Cockpit — SELESAI
- [x] Intel/sharing — SELESAI
- [x] 2-teleport mobility — SELESAI
- [x] Universal Baseline — SELESAI (plus serve --vessel wire)
- [x] V4 component-based capability — SELESAI
- [x] V4 provenance lineage — SELESAI
- [x] Heavy-stable — SELESAI
- [x] `apps/game` bootstrap — SELESAI
- [x] UHD renderer SUPER HD — SELESAI
- [x] Visual identity game-native — SELESAI
- [x] Ark-Librarieschip vessel-world — SELESAI (plus clouds di SEMUA planet)
- [x] Cockpit ops-console — SELESAI
- [x] Ship follow-camera — SELESAI
- [x] Seeded RNG — SELESAI
- [x] Kinetic-energy collision — SELESAI
- [x] Server launcher production — SELESAI (plus serve --vessel)
- [x] Gate handoff transactional — SELESAI
- [x] Landing MMO AAA+ — SELESAI (landing.ts live CCTV + glass)
- [x] Quickstart MMO EN — SELESAI
- [x] 09 Fase 1 env map — SELESAI
- [x] 09 Fase 2 vessel AAA+ — SELESAI
- [x] 09 Fase 3 Ark stadium — SELESAI
- [x] 09 Fase 4 explosion — SELESAI
- [x] 09 Fase 5 5 SFX — SELESAI
- [x] Clouds AAA+ di SEMUA planet — SELESAI (pause 09)
- [x] 09 Fase 6 custom music (MP3/OGG/WAV/FLAC decode via AudioContext, playlist, menu.ts + audio.ts) — SELESAI (PR #642, doc sync 09-04)
- [x] 09 Fase 7 UI polish (hud.ts fade+glow + menu.ts hover+slide-in) — SELESAI
- [ ] 09 Part B Fase 8 FPS interior (interior.ts 480 + renderer.ts + input.ts FPS_INTERIOR)
- [ ] 09 Part B Fase 9 karakter repo (CharacterEntity + spawnCharacter)
- [ ] 09 Part B Fase 10 hangar 32 slot + docking film 3s (gate.ts + bridge.ts)
- [ ] 09 Part B Fase 11 bazaar 16 lapak (component.ts + validator)
- [ ] 09 Part B Fase 12 stadium bebas (arclux.stadium.json → spawnStation)

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
| 2026-09-02 | #630 | 09 Fase 1+2 env map PMREM + vessel AAA+ fuselage+canopy+delta wings+nacelles | ✅ merged |
| 2026-09-02 | #631 | 09 Fase 3 Ark stadium 12 komponen 4 ring InstancedMesh (habitat/docking/platform/windows) | ✅ merged |
| 2026-09-02 | #632 | 09 Fase 4 explosion 5 burst+12 debris+30 sparks+flash 2s | ✅ merged |
| 2026-09-02 | #633 | fix serve --vessel auto-spawn wire (apps/cli/serve.ts:36, tanpa nebak) | ✅ merged |
| 2026-09-03 | #635 | landing MMO AAA+ live CCTV scene3d bg + glass + live stats (landing.ts) | ✅ merged |
| 2026-09-03 | #636 | quickstart MMO EN (QUICKSTART-MMO.md English from zero) | ✅ merged |
| 2026-09-03 | #638 | 09 Fase 5 5 SFX explosion/weapon/shield/debris/ambient hum (audio.ts) | ✅ merged |
| 2026-09-03 | #639 | clouds AAA+ di SEMUA planet procedural makeCloudTexture 512, visual-only | ✅ merged |
| 2026-09-03 | — | update MMO-IMPLEMENTATION.md ketinggalan → sync 09 + clouds + landing + serve --vessel | in progress |
