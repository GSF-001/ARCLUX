# ARCLUX MMO — IMPLEMENTATION MAP (anti-lupa)

> **Ini "otak" scaffolding.** Sebelum ngoding MMO, baca ini dulu: cek status
> tiap modul, tahu udah dibikin apa, tinggal isi apa, dan mau diarahin ke mana.
> JANGAN ngulang bikin yang udah ada — baca §Status dulu.
>
> Semantic: ✅ = berfungsi & terverifikasi · 🚧 = kerangka/parsial · ⬜ = kosong.
> Tiap file yang di-update harus isi §Arah sesuai checklist di bawah ini.

Update terakhir: 2026-09-05 (Fase 8 interior 6 iris PR #664-669 + checklist 09 sync; v0.3.0 rilis + progres sync).


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
  + Fase 3 (PR #773): resistensi fit target via
  `fitCalc::computeResists` dari komponen terpasang (impact.resisted,
  cap MAX_RESIST); weapon tak dikenal tetap jalur polos
- `fitting.ts` (PR #772 + #773) — fit authority: fittedComponents/
  liveFit/projectFitAction/validateFitIntent (intent equip/unequip,
  expectHash anti-cheat, slot/prerequisite gate) + stepCapacitor
  (kapasitor authoritative per tick, formula `capStep` dari universe)
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

**Sudah diisi (PR #775 — Sprint 1 hardening, `08-server-hardening.md` §4):**
- `auth.ts` ✅ — `POST /login` → Bearer HMAC token {sub,iat,exp} + TTL;
  `signHandoff`/`verifyHandoff` (HMAC raw body ±60s, timingSafeEqual);
  `isDeliverAllowed` (loopback + allowlist); secret via env
  `ARCLUX_AUTH_SECRET`/`ARCLUX_HANDOFF_SECRET`.
- `server.ts` ✅ — `/intent` rate limit (429 + shadowban) + auth 401 +
  seq stale 409 + identity mismatch rejected + ack `{ok,seq,verdict}`;
  `/deliver` IP allowlist 403 + HMAC 403 + `sanitizeVesselModel`
  (clamp+recompute agregat, D-008) ; `readBody` 1MB → 413;
  `GET /servers` (visibility/federation/status filter);
  lifecycle: `persistence` option, resume-on-start, save-on-stop,
  autosave 100 tick, heartbeat 10s + port aktual dari `server.address()`.
- `simulation.ts` ✅ (+guard) — `checkStability` per step (stability_trip →
  trim separuh), entity cap → `spawn_rejected`, E-5 posisi/id `spawn_station`
  dari seeded rng (Math.random/Date.now sim path = 0).
- `validator.ts` ✅ (+E-1) — `resolveTradeSeller`/`actorOwnsSeller` tutup
  trade theft (dipakai juga di sim = 2 lapis).
- `world.ts` ✅ (+`restore` resume) · `directory/registry.ts` ✅ TTL 30s
  `effectiveStatus` + `listServersWithHealth` ·
  `transport/HttpClientTransport.ts` ✅ auto-login + retry 401 +
  `handoffSigner` opt-in (browser gak pegang secret) ·
  `apps/cli/serve.ts` ✅ persistence default ON (`--no-persist`).
- Regresi: `tests/server-hardening-sprint1.test.ts` 20 test.

**Sudah diisi (PR #779 — Sprint 2 otoritas fitur, `08-server-hardening.md` §4):**
- `packages/economy` ✅ — integer OC, pajak 5% → `world:treasury` (floor),
  Company Store 13 item harga tetap, P2P `transfer` append-only tx log +
  idempotency key `intent:<player>:<seq>`, `buyFromStore` origin arclux
  durability 100, `topup` minimum 10 OC.
- `packages/wanted` ✅ — eskalasi saksi (`WITNESS_RADIUS_M` 50; tanpa
  saksi = tanpa record, 05 §2.2), bobot kill 3/riot 2/theft 1 cap 5,
  blacklist per communityId, gate ≥3, decay 1 level/36k tick tunable.
- `session.ts` ✅ — activeMode ship/fps per pemain + `SHIP_ONLY_INTENTS`
  (attack/teleport/scan/dock/spawn_station/activate_capability/equip…) +
  `FPS_ONLY_INTENTS` (use_skill, gate-nya dulu); transisi:
  `spawn_character`→fps, `dock`→ship, intent `fps_switch_mode`.
- `claims.ts` ✅ — klaim 100×100, radius tanam 500m, maks 3 petak/pemain
  (anti-serakah), overlap check. Patok 7 hari + garis pantai = Sprint 5.
- `hack.ts` ✅ — attempt 4-6 tombol (idx 0-5) seed FNV-1a
  `(player,target,tick)`, cooldown 600 tick/target, range 10m/5m; efek:
  engine disable 3000 tick (validator `move` tolak), delta wanted tabel
  06 §3.4, 3 fail → alarm 12k tick + wanted +2. Requirement "computer"
  ditunda Sprint 5 (component registry kosong).
- `visibility.ts` ✅ — `sanitizeSnapshot(snap, viewer)`: owner penuh,
  pemirsa lain komponen non-open → `{id,capability}` (tanpa label/
  provenance/license), tanpa viewer = legacy penuh; copy-on-write, asli
  tak dimutasi (P2-4).
- `validator.ts` ✅ (+P1) — tether 1000m tujuan→kapal, scan cooldown +
  range ≤10km, mode gate, wanted gate/blacklist, hack range/cooldown +
  attempt, OC cost buy/sell (termasuk "buyer has no vessel"), klaim
  radius/overlap/anti-serakah, `engines disabled` bila kena hack;
  hapus dead code `case "spawn"` (P1-2).
- `simulation.ts` ✅ (+P1) — authority injection (`SimulationOptions.authority`
  → ctx bila authProvider belum bawa), kill trigger → `vessel_destroyed`
  + escalate (saksi = owner lain ≤50m), scan redact payload
  `{id,kind,faction}`, fps/ship transisi, apply buy/sell/claim/hack,
  wanted decay per step; `sell_player` cari kapal pembeli by owner.
- `server.ts` ✅ (+P1) — `AuthorityDeps` bundle (sessions/wanted/economy/
  hacks/claims) → engine + `/intent` ctx + `handle.authority`; `/snapshot`
  sanitize viewer (Bearer sub / `?playerId=`);
  `transport/HttpTransport.ts` `/snapshot?playerId=`.
- Regresi: `tests/server-sprint2.test.ts` 23 test.
- 
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
12. **09 Client Polish Part A** — Fase 1 env map PMREM `scene.environment` tiap 10 frame (PR #630) + Fase 2 vessel AAA+ fuselage+canopy+delta wings+nacelles (PR #630) + Fase 3 Ark stadium 12 komponen 4 ring InstancedMesh (PR #631) + Fase 4 explosion 5 burst+12 debris+30 sparks+flash (PR #632) + Fase 5 5 SFX `audio.ts` (PR #638) + **Fase 6 custom music** MP3/OGG/WAV/FLAC decode + playlist + AUDIO tab `audio.ts` + `menu.ts` (PR #642) + **Fase 7 UI polish** `hud.ts` (fadeOnChange/hash-guard, target glow pulse, scanline drift, hierarchy, gradient edges) + `menu.ts` (wireHover/wireSliderGlow, tab fade, slide-in 0.3s) (PR #649) + **Fase 8 FPS interior 6 iris** `interior.ts` corridor+promenade+plaza+96 habitat+lighting, `input.ts` FPS 60Hz Box3, `CharacterEntity`+`DockingState`, `hud` deck + `scene3d` interior camera (PR #664-669) — **Fase 1-8 DONE, Part B 9-12 next**.
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
### PR #772 ✅ Fase 3 fit authority — fitting.ts (validateFitIntent equip/unequip) + stateHash=fitHash — SUDJAH (2026-10-06)
### PR #773 ✅ Fase 3 sisa — kapasitor per tick (stepCapacitor + gate activate) + combat resist fit — SUDJAH (2026-10-06)
### PR #775 ✅ Sprint 1 server hardening — auth.ts (login+handoff HMAC) + E-1..E-5 + rate limit/1MB + /servers TTL + lifecycle persistence — SUDAH (2026-10-06)
### PR #779 ✅ Sprint 2 otoritas fitur — economy/wanted/session/claims/hack/visibility + validator/sim P1-2..P1-9 + P2-4 sanitize snapshot + mode gate — SUDJAH (2026-10-08)
### PR #785 ✅ Docs spec Sprint 7 combat depth — `ue/09-combat-depth.md` (lock-on, projectile bisa-dielak, NPC AI, damage pipeline) + slot Sprint 7 di 08 §4 — SUDAH (2026-10-08, docs-only, eksekusi menyusul)
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
- [x] 09 Fase 8 FPS interior 6 iris — corridor+promenade (iris1) + plaza+96 habitat (iris2) + lighting PMREM reuse (iris3) + FPS controller 60Hz Box3 (iris4) + CharacterEntity+DockingState (iris5) + HUD deck+camera FPS (iris6) — SELESAI (PR #664-669)
- [x] `fitting.ts` — Fase 3 fit authority (equip/unequip + expectHash anti-cheat) + kapasitor per tick `stepCapacitor` — SELESAI (PR #772 + #773)
- [x] Fase 3 sisa: combat resist fit `computeResists` + gate `activate_capability` saat kapasitor 0 — SELESAI (PR #773)
- [x] `auth.ts` — login Bearer HMAC + handoff HMAC + isDeliverAllowed — SELESAI (PR #775)
- [x] `server.ts` — Sprint 1 route hardening: auth 401 + rate limit 429 + seq 409 + 413 + /deliver guard + /servers + lifecycle persistence — SELESAI (PR #775)
- [x] `session.ts` — activeMode ship/fps + SHIP_ONLY/FPS_ONLY gate + spawn_character/dock/fps_switch_mode — SELESAI (PR #779)
- [x] `claims.ts` — klaim 100x100 radius tanam 500m maks 3 petak + overlap + anti-serakah — SELESAI (PR #779)
- [x] `hack.ts` — attempt FNV-1a 4-6 tombol + cooldown 600 tick + engine-disable/wanted delta/3-fail alarm — SELESAI (PR #779)
- [x] `visibility.ts` — sanitizeSnapshot per-pemirsa (owner penuh, redact {id,capability}, anonim legacy) — SELESAI (PR #779)
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
| 2026-10-06 | #775 | Sprint 1 server hardening (08 §4): auth.ts login+handoff HMAC, E-1..E-5, rate limit/1MB/403/409, /servers TTL, lifecycle persistence, 20 regresi test | in progress |
| 2026-10-08 | #779 | Sprint 2 otoritas fitur (08 §4): packages/economy+wanted, session/claims/hack/visibility, validator/sim P1-2..P1-9 + P2-4 sanitize snapshot, 23 regresi test | in progress |
| 2026-10-08 | #785 | Docs spec Sprint 7 combat depth (riset 3 repo UE5, ideas-only): ue/09-combat-depth.md + slot Sprint 7 di 08 §4 + README indeks | in progress |

